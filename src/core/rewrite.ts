import { basename, stripMd, titleOf } from './paths'
import type { ResolvedLink, VaultIndex } from './vaultIndex'

export interface TextEdit {
  from: number
  to: number
  insert: string
}

/** Apply non-overlapping edits to a string. */
export function applyEdits(text: string, edits: TextEdit[]): string {
  let out = text
  for (const e of [...edits].sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.insert + out.slice(e.to)
  return out
}

/**
 * The target text to write for a link that pointed at a note that is now at `newPath`.
 * Keeps the link's style: bare names stay bare when unambiguous, path links stay paths,
 * an explicit `.md` suffix is kept.
 */
export function newLinkTarget(link: Pick<ResolvedLink, 'target'>, newPath: string, titleIsUnique: boolean): string {
  const hadMd = link.target.toLowerCase().endsWith('.md')
  const hadPath = link.target.includes('/')
  const base = hadPath || !titleIsUnique ? stripMd(newPath) : titleOf(newPath)
  return hadMd ? base + '.md' : base
}

/**
 * Plan the text changes needed across the vault when `oldPath` is renamed to `newPath`.
 * Must be called before the index is updated. Returns only notes whose text changes.
 */
export function planRename(index: VaultIndex, oldPath: string, newPath: string): Map<string, string> {
  const newTitle = titleOf(newPath)
  const others = index.pathsWithTitle(newTitle).filter((p) => p !== oldPath)
  const unique = others.length === 0
  const sources = new Set(index.backlinksOf(oldPath))
  if (index.get(oldPath)) sources.add(oldPath) // self links like [[#Heading]] or [[Self]]
  const result = new Map<string, string>()
  for (const src of sources) {
    const note = index.get(src)
    if (!note) continue
    const edits: TextEdit[] = []
    for (const l of index.linksBetween(src, oldPath)) {
      if (!l.target) continue // [[#heading]] is relative to the note itself, nothing to change
      const next = newLinkTarget(l, newPath, unique)
      if (next !== l.target) edits.push({ from: l.targetFrom, to: l.targetTo, insert: next })
    }
    if (edits.length) result.set(src, applyEdits(note.text, edits))
  }
  return result
}

/** Plan for links that point to an asset (non-markdown) path being renamed. */
export function planAssetRename(index: VaultIndex, oldPath: string, newPath: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const src of index.backlinksOf(oldPath)) {
    const note = index.get(src)
    if (!note) continue
    const edits = index.linksBetween(src, oldPath).map((l) => ({
      from: l.targetFrom,
      to: l.targetTo,
      insert: l.target.includes('/') ? newPath : basename(newPath),
    }))
    if (edits.length) result.set(src, applyEdits(note.text, edits))
  }
  return result
}
