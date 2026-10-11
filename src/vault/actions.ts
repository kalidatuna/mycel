import { mentionToLink } from '../core/mentions'
import { basename, dirname, INVALID_NAME, isMarkdown, join, stripMd } from '../core/paths'
import { planRename } from '../core/rewrite'
import { applyTemplate, dailyNotePath, isoDate, TEMPLATE_FOLDER } from '../core/templates'
import type { Note } from '../core/vaultIndex'
import { flushAll } from '../editor/pending'
import { docCache } from '../editor/stateCache'
import { toast } from '../store/ui'
import { useVault } from '../store/vault'
import { useWorkspace } from '../store/workspace'
import { requireFs, session } from './session'

const bump = () => {
  useVault.getState().set({ folders: [...session.folders].sort() })
  useVault.getState().bump()
}

function indexNote(path: string, text: string, mtime: number): Note {
  const note = session.index.upsert({ path, text, mtime })
  session.search.update(note)
  return note
}

function addFolders(path: string) {
  const parts = path.split('/')
  for (let i = 1; i < parts.length; i++) session.folders.add(parts.slice(0, i).join('/'))
}

async function writeFile(path: string, text: string) {
  const mtime = await requireFs().write(path, text)
  session.watcher?.record(path, { path, kind: 'file', mtime, size: new Blob([text]).size })
  return mtime
}

/** Save note text. Skips the write entirely when nothing changed. */
export async function saveNote(path: string, text: string): Promise<boolean> {
  const cur = session.index.get(path)
  if (cur && cur.text === text) return false
  const mtime = await writeFile(path, text)
  indexNote(path, text, mtime)
  bump()
  return true
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Name cannot be empty'
  if (INVALID_NAME.test(name)) return 'Names cannot contain \\ / : * ? " < > | # ^ [ ]'
  if (name.startsWith('.')) return 'Names cannot start with a dot'
  return null
}

/** First free "Untitled.md", "Untitled 1.md", ... in `folder`. */
export function freeNotePath(folder: string, title: string): string {
  for (let i = 0; ; i++) {
    const p = join(folder, `${title}${i ? ' ' + i : ''}.md`)
    if (!session.index.get(p) && !session.folders.has(p)) return p
  }
}

export async function createNote(path: string, text = '', open = true): Promise<string> {
  if (session.index.get(path)) throw new Error(`"${path}" already exists`)
  if (await requireFs().exists(path)) throw new Error(`"${path}" already exists on disk`)
  const mtime = await writeFile(path, text)
  addFolders(path)
  indexNote(path, text, mtime)
  bump()
  if (open) useWorkspace.getState().open(path)
  return path
}

export async function createFolder(path: string) {
  await requireFs().mkdir(path)
  addFolders(path + '/x')
  bump()
}

/** Rename or move a note and rewrite every link that points to it. */
export async function renameNote(from: string, to: string): Promise<boolean> {
  if (from === to) return false
  if (!isMarkdown(to)) to += '.md'
  const err = validateName(stripMd(basename(to)))
  if (err) throw new Error(err)
  const caseOnly = from.toLowerCase() === to.toLowerCase()
  if (!caseOnly && (session.index.get(to) || (await requireFs().exists(to)))) throw new Error(`"${to}" already exists`)
  await flushAll()
  const plan = planRename(session.index, from, to)
  const note = session.index.get(from)
  const fs = requireFs()
  if (caseOnly) {
    // Some file systems are case-insensitive: go through a temporary name.
    const tmp = `${from}.mycel-tmp`
    await fs.rename(from, tmp)
    await fs.rename(tmp, to)
  } else await fs.rename(from, to)
  const text = plan.get(from) ?? note?.text ?? ''
  plan.delete(from)
  session.index.remove(from)
  session.search.remove(from)
  session.watcher?.record(from, null)
  addFolders(to)
  const { mtime } = await fs.read(to)
  session.watcher?.record(to, { path: to, kind: 'file', mtime, size: new Blob([note?.text ?? '']).size })
  // A self-link rewrite is applied to the moved file itself.
  if (text !== note?.text) indexNote(to, text, await writeFile(to, text))
  else indexNote(to, text, mtime)
  docCache.rename(from, to)
  useWorkspace.getState().renamePath(from, to)
  let rewritten = 0
  for (const [src, newText] of plan) {
    try {
      indexNote(src, newText, await writeFile(src, newText))
      rewritten++
    } catch (e) {
      toast(`Could not update links in "${src}": ${(e as Error).message}`, 'error')
    }
  }
  bump()
  if (rewritten) toast(`Updated links in ${rewritten} note${rewritten === 1 ? '' : 's'}`, 'success')
  return true
}

export async function renameFolder(from: string, to: string) {
  if (from === to || to.startsWith(from + '/')) return
  if (session.folders.has(to) || (await requireFs().exists(to))) throw new Error(`"${to}" already exists`)
  const err = validateName(basename(to))
  if (err) throw new Error(err)
  await createFolder(to)
  const inside = [...session.index.notes.keys()].filter((p) => p.startsWith(from + '/'))
  for (const p of inside) await renameNote(p, to + p.slice(from.length))
  await removeEmptyFolders(from)
  useWorkspace.getState().renamePath(from, to)
  bump()
}

async function removeEmptyFolders(root: string) {
  const fs = requireFs()
  const dirs = [...session.folders].filter((d) => d === root || d.startsWith(root + '/')).sort((a, b) => b.length - a.length)
  for (const d of dirs) {
    try {
      await fs.removeEmptyDir(d)
      if (!(await fs.exists(d))) session.folders.delete(d)
    } catch {
      /* not empty (non-note files): keep it */
    }
  }
}

export const moveNote = (path: string, folder: string) => renameNote(path, join(folder, basename(path)))

export async function moveFolder(path: string, folder: string) {
  await renameFolder(path, join(folder, basename(path)))
}

/** Move a note to `.trash/`. Never deletes. */
export async function trashNote(path: string) {
  await flushAll()
  const dest = await requireFs().trash(path)
  session.index.remove(path)
  session.search.remove(path)
  session.watcher?.record(path, null)
  useWorkspace.getState().removePath(path)
  bump()
  return dest
}

export async function trashFolder(path: string) {
  await flushAll()
  for (const p of [...session.index.notes.keys()].filter((p) => p.startsWith(path + '/'))) await trashNote(p)
  await removeEmptyFolders(path)
  useWorkspace.getState().removePath(path)
  bump()
}

/** Follow a wikilink: open the target, creating it at the vault root if missing. */
export async function followLink(target: string, fromPath: string, heading?: string, newTab = false) {
  const resolved = session.index.resolve(target, fromPath)
  const ws = useWorkspace.getState()
  if (resolved && session.index.get(resolved)) return ws.open(resolved, { newTab, anchor: heading ? { heading } : undefined })
  if (resolved) return toast(`"${target}" is not a note`, 'info')
  const name = stripMd(basename(target.trim()))
  const err = validateName(name)
  if (err) return toast(`Can't create "${target}": ${err}`, 'error')
  const folder = target.includes('/') ? dirname(stripMd(target.trim())) : ''
  const path = join(folder, name + '.md')
  await createNote(path, `# ${name}\n\n`, false)
  ws.open(path, { newTab })
  toast(`Created "${name}"`, 'success')
}

/** Replace a plain-text mention with a link. Re-checks the text so stale offsets never corrupt a note. */
export async function linkMention(source: string, from: number, to: number, match: string, title: string) {
  const note = session.index.get(source)
  if (!note || note.text.slice(from, to) !== match) return toast('That note changed; refresh the list and try again', 'error')
  await flushAll()
  const fresh = session.index.get(source)!
  if (fresh.text.slice(from, to) !== match) return toast('That note changed; refresh the list and try again', 'error')
  await saveNote(source, fresh.text.slice(0, from) + mentionToLink(match, title) + fresh.text.slice(to))
}

export function templates(): Note[] {
  return [...session.index.notes.values()].filter((n) => n.path.startsWith(TEMPLATE_FOLDER + '/')).sort((a, b) => a.title.localeCompare(b.title))
}

/** Open today's daily note, creating it from "Templates/Daily Note" when that exists. */
export async function openDailyNote(date = new Date()) {
  const path = dailyNotePath(date)
  if (session.index.get(path)) return useWorkspace.getState().open(path)
  const tpl = templates().find((t) => /daily/i.test(t.title))
  const title = isoDate(date)
  await createNote(path, tpl ? applyTemplate(tpl.text, { title, date }) : `# ${title}\n\n`)
}

/** Apply external file changes reported by the watcher. Idempotent. */
export async function applyExternalChanges(changes: { type: 'added' | 'changed' | 'removed'; entry: { path: string; kind: 'file' | 'dir'; mtime: number } }[]) {
  const fs = requireFs()
  let touched = false
  for (const { type, entry } of changes) {
    const { path, kind } = entry
    if (kind === 'dir') {
      if (type === 'removed') session.folders.delete(path)
      else addFolders(path + '/x')
      touched = true
      continue
    }
    if (!isMarkdown(path)) {
      if (type === 'removed') session.index.remove(path)
      else session.index.assets.add(path)
      touched = true
      continue
    }
    if (type === 'removed') {
      if (session.index.get(path)) {
        session.index.remove(path)
        session.search.remove(path)
        useWorkspace.getState().removePath(path)
        touched = true
      }
      continue
    }
    try {
      const { text, mtime } = await fs.read(path)
      if (session.index.get(path)?.text === text) continue
      addFolders(path)
      indexNote(path, text, mtime)
      touched = true
    } catch {
      /* vanished between list and read */
    }
  }
  if (touched) bump()
}
