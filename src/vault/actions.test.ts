import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryFS } from '../fs/memoryFs'
import { useWorkspace } from '../store/workspace'
import * as actions from './actions'
import { openVault } from './loader'
import { session } from './session'

let fs: MemoryFS

async function setup(files: Record<string, string>) {
  fs = new MemoryFS('test', Object.entries(files).map(([path, text]) => ({ path, text, mtime: 1 })))
  await openVault(fs)
  session.watcher?.stop()
}

const read = async (p: string) => (await fs.read(p)).text

describe('vault actions', () => {
  beforeEach(() => setup({
    'A.md': '---\ntags: [x]\n---\nLinks to [[B]] and [[B|bee]] and [[B#Part]].',
    'B.md': '# B\n## Part\n',
    'folder/C.md': 'See [[B]] and [[folder/C]].',
    'Untouched.md': 'No links here.',
  }))

  it('save skips writes when content is unchanged', async () => {
    const before = (await fs.read('A.md')).mtime
    expect(await actions.saveNote('A.md', session.index.get('A.md')!.text)).toBe(false)
    expect((await fs.read('A.md')).mtime).toBe(before)
  })

  it('rename rewrites inbound links and nothing else', async () => {
    const untouchedMtime = (await fs.read('Untouched.md')).mtime
    await actions.renameNote('B.md', 'Bee Note.md')
    expect(await read('A.md')).toBe('---\ntags: [x]\n---\nLinks to [[Bee Note]] and [[Bee Note|bee]] and [[Bee Note#Part]].')
    expect(await read('folder/C.md')).toBe('See [[Bee Note]] and [[folder/C]].')
    expect(await fs.exists('B.md')).toBe(false)
    expect(await read('Bee Note.md')).toBe('# B\n## Part\n')
    expect((await fs.read('Untouched.md')).mtime).toBe(untouchedMtime)
    expect(session.index.backlinksOf('Bee Note.md')).toEqual(['A.md', 'folder/C.md'])
  })

  it('moving a note with a path link to itself rewrites that link', async () => {
    await actions.moveNote('folder/C.md', 'other')
    expect(await read('other/C.md')).toBe('See [[B]] and [[other/C]].')
  })

  it('rename keeps open tabs pointing at the note', async () => {
    useWorkspace.getState().open('B.md')
    await actions.renameNote('B.md', 'folder/B2.md')
    expect(useWorkspace.getState().panes[0]!.active).toBe('folder/B2.md')
  })

  it('refuses to overwrite an existing note', async () => {
    await expect(actions.renameNote('B.md', 'Untouched.md')).rejects.toThrow(/already exists/)
    expect(await read('B.md')).toBe('# B\n## Part\n')
  })

  it('trash moves to .trash and never deletes', async () => {
    await actions.trashNote('B.md')
    expect(await fs.exists('B.md')).toBe(false)
    expect(await read('.trash/B.md')).toBe('# B\n## Part\n')
    await actions.createNote('B.md', 'again', false)
    await actions.trashNote('B.md')
    expect(await read('.trash/B 1.md')).toBe('again')
    expect(session.index.outgoing.get('A.md')![0]!.resolved).toBeNull()
  })

  it('folder rename moves notes and rewrites path links', async () => {
    await actions.renameFolder('folder', 'renamed')
    expect(await read('renamed/C.md')).toBe('See [[B]] and [[renamed/C]].')
    expect(session.folders.has('folder')).toBe(false)
  })

  it('following a missing link creates the note at the root', async () => {
    await actions.followLink('Brand New', 'A.md')
    expect(await read('Brand New.md')).toBe('# Brand New\n\n')
    expect(useWorkspace.getState().panes[0]!.active).toBe('Brand New.md')
  })

  it('link it replaces exactly the mention', async () => {
    await actions.saveNote('Untouched.md', 'I mention b here.')
    await actions.linkMention('Untouched.md', 10, 11, 'b', 'B')
    expect(await read('Untouched.md')).toBe('I mention [[B|b]] here.')
  })

  it('daily note uses the template', async () => {
    await actions.createNote('Templates/Daily.md', '# {{date}}\n', false)
    await actions.openDailyNote(new Date(2026, 9, 11))
    expect(await read('Daily/2026-10-11.md')).toBe('# 2026-10-11\n')
  })

  it('applies external changes from the watcher', async () => {
    fs.externalWrite('B.md', '# B changed')
    fs.externalWrite('New.md', '[[B]]')
    await actions.applyExternalChanges([
      { type: 'changed', entry: { path: 'B.md', kind: 'file', mtime: 9 } },
      { type: 'added', entry: { path: 'New.md', kind: 'file', mtime: 9 } },
    ])
    expect(session.index.get('B.md')!.text).toBe('# B changed')
    expect(session.index.backlinksOf('B.md')).toContain('New.md')
  })
})
