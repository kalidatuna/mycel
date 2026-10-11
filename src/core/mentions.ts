import { blankRanges } from './parse'
import type { Note, VaultIndex } from './vaultIndex'

export interface Mention {
  source: string
  from: number
  to: number
  /** The matched text as it appears in the source. */
  match: string
  /** The line around the match, with the match offsets relative to it. */
  line: string
  lineFrom: number
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Text with frontmatter, code, comments and existing links blanked out. */
export function searchableBody(note: Note): string {
  return blankRanges(blankRanges(note.text, note.parsed.skipped), note.parsed.links.map((l) => [l.from, l.to]))
}

/** Places where other notes mention this note's title or aliases without linking it. */
export function unlinkedMentions(index: VaultIndex, path: string, limit = 200): Mention[] {
  const note = index.get(path)
  if (!note) return []
  const names = [note.title, ...note.parsed.aliases].filter((n) => n.trim().length >= 3)
  if (!names.length) return []
  names.sort((a, b) => b.length - a.length)
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')
  const out: Mention[] = []
  for (const other of index.notes.values()) {
    if (other.path === path) continue
    const body = searchableBody(other)
    for (const m of body.matchAll(re)) {
      // Skip headings that are the note's own title line and tag-like matches (#Name).
      if (body[m.index - 1] === '#') continue
      const lineFrom = other.text.lastIndexOf('\n', m.index - 1) + 1
      const nl = other.text.indexOf('\n', m.index)
      const line = other.text.slice(lineFrom, nl === -1 ? other.text.length : nl)
      out.push({ source: other.path, from: m.index, to: m.index + m[0].length, match: m[0], line, lineFrom })
      if (out.length >= limit) return out
    }
  }
  return out
}

/** The replacement text that turns a mention into a link to `title`. */
export function mentionToLink(match: string, title: string): string {
  return match === title ? `[[${title}]]` : `[[${title}|${match}]]`
}
