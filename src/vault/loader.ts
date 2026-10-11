import { isMarkdown } from '../core/paths'
import type { NoteInput } from '../core/vaultIndex'
import { FsAccessFS } from '../fs/fsAccess'
import { saveHandle } from '../fs/handleStore'
import { MemoryFS } from '../fs/memoryFs'
import type { VaultFS } from '../fs/types'
import { VaultWatcher } from '../fs/watcher'
import { useVault } from '../store/vault'
import { persistWorkspace, restoreWorkspace, useWorkspace } from '../store/workspace'
import { applyExternalChanges } from './actions'
import { session } from './session'

let unpersist: (() => void) | null = null

export async function openVault(fs: VaultFS) {
  const vault = useVault.getState()
  session.watcher?.stop()
  unpersist?.()
  vault.set({ status: 'loading', name: fs.name, kind: fs.kind, error: null, progress: { done: 0, total: 0 } })
  try {
    const t0 = performance.now()
    const entries = await fs.list()
    const files = entries.filter((e) => e.kind === 'file')
    const md = files.filter((e) => isMarkdown(e.path))
    vault.set({ progress: { done: 0, total: md.length } })
    const notes: NoteInput[] = []
    for (let i = 0; i < md.length; i += 32) {
      const batch = md.slice(i, i + 32)
      const read = await Promise.all(batch.map(async (e) => ({ path: e.path, ...(await fs.read(e.path).catch(() => null)) })))
      for (const r of read) if (typeof r.text === 'string') notes.push({ path: r.path, text: r.text, mtime: r.mtime! })
      vault.set({ progress: { done: Math.min(i + 32, md.length), total: md.length } })
    }
    session.fs = fs
    session.folders = new Set(entries.filter((e) => e.kind === 'dir').map((e) => e.path))
    session.index.load(notes, files.filter((e) => !isMarkdown(e.path)).map((e) => e.path))
    session.search.build(session.index.notes.values())
    session.watcher = new VaultWatcher(fs, applyExternalChanges)
    session.watcher.start(entries)
    const loadMs = Math.round(performance.now() - t0)
    console.info(`[mycel] indexed ${notes.length} notes in ${loadMs} ms`)
    if (!restoreWorkspace(fs.name, (p) => !!session.index.get(p))) {
      useWorkspace.getState().reset()
      const first = pickStartNote()
      if (first) useWorkspace.getState().open(first)
    }
    unpersist = persistWorkspace(fs.name)
    vault.set({ status: 'ready', folders: [...session.folders].sort(), loadMs })
    vault.bump()
  } catch (e) {
    vault.set({ status: 'error', error: (e as Error).message })
  }
}

/** A welcoming first note: a README/home-ish note, else the most recently edited one. */
function pickStartNote(): string | null {
  const notes = [...session.index.notes.values()]
  const home = notes.find((n) => /^(readme|home|index|start here|welcome)$/i.test(n.title))
  if (home) return home.path
  return notes.sort((a, b) => b.mtime - a.mtime)[0]?.path ?? null
}

export async function openFolder(handle: FileSystemDirectoryHandle) {
  await saveHandle(handle).catch(() => undefined)
  await openVault(new FsAccessFS(handle))
}

export async function openDemoVault() {
  const { default: files } = await import('virtual:demo-vault')
  await openVault(new MemoryFS('Demo vault', files))
}
