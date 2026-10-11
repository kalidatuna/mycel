import { hashText } from './hash'
import { parseCreated, parseNote, type Link, type ParsedNote } from './parse'
import { basename, dirname, extname, isMarkdown, stripMd, titleOf } from './paths'

export interface Note {
  path: string
  title: string
  text: string
  mtime: number
  created: number
  hash: string
  parsed: ParsedNote
}

export interface ResolvedLink extends Link {
  /** Vault path of the target note/asset, or null when the link is broken. */
  resolved: string | null
}

export interface NoteInput {
  path: string
  text: string
  mtime: number
}

/** Lowercased last path segment of a link target without `.md`: the key used for bare-name lookups. */
export const linkKey = (target: string) => stripMd(basename(target)).toLowerCase()

/**
 * In-memory index of a vault: notes, resolved links, backlinks, tags.
 * Mutable on purpose; UI subscribes to `version` instead of copying it.
 */
export class VaultIndex {
  readonly notes = new Map<string, Note>()
  readonly assets = new Set<string>()
  readonly outgoing = new Map<string, ResolvedLink[]>()
  readonly backlinks = new Map<string, Set<string>>()
  /** lowercased title → paths with that title */
  private readonly byTitle = new Map<string, Set<string>>()
  /** lowercased link key → notes that contain a link with that key */
  private readonly linkers = new Map<string, Set<string>>()
  version = 0

  // ---------- queries ----------

  get size() {
    return this.notes.size
  }

  get(path: string) {
    return this.notes.get(path)
  }

  /** Resolve a link target written in `fromPath` to a note or asset path. */
  resolve(target: string, fromPath: string): string | null {
    const t = target.trim().replace(/^\/+/, '')
    if (!t) return this.notes.has(fromPath) ? fromPath : null
    const ext = extname(t)
    if (ext && ext !== 'md') return this.resolveAsset(t)
    const lower = stripMd(t).toLowerCase()
    if (lower.includes('/')) {
      let best: string | null = null
      for (const p of this.notes.keys()) {
        const pl = stripMd(p).toLowerCase()
        if (pl === lower) return p
        if (pl.endsWith('/' + lower) && (!best || p.length < best.length)) best = p
      }
      return best
    }
    const candidates = this.byTitle.get(lower)
    if (!candidates || candidates.size === 0) return null
    if (candidates.size === 1) return candidates.values().next().value!
    return pickClosest([...candidates], fromPath)
  }

  private resolveAsset(t: string): string | null {
    const lower = t.toLowerCase()
    let best: string | null = null
    for (const a of this.assets) {
      const al = a.toLowerCase()
      if (al === lower) return a
      if ((al.endsWith('/' + lower) || basename(al) === lower) && (!best || a.length < best.length)) best = a
    }
    return best
  }

  /** Paths of notes that link to `path`. */
  backlinksOf(path: string): string[] {
    return [...(this.backlinks.get(path) ?? [])].filter((p) => p !== path).sort()
  }

  /** Links in `source` that point to `target`. */
  linksBetween(source: string, target: string): ResolvedLink[] {
    return (this.outgoing.get(source) ?? []).filter((l) => l.resolved === target)
  }

  /** Notes sharing a lowercased title with `title` (used to decide if a bare link is unambiguous). */
  pathsWithTitle(title: string): string[] {
    return [...(this.byTitle.get(title.toLowerCase()) ?? [])]
  }

  /** All tags with the notes that use them. Keys are lowercased; `label` keeps first-seen casing. */
  tags(): Map<string, { label: string; paths: Set<string> }> {
    const out = new Map<string, { label: string; paths: Set<string> }>()
    for (const n of this.notes.values()) {
      for (const t of n.parsed.tags) {
        const key = t.name.toLowerCase()
        let e = out.get(key)
        if (!e) out.set(key, (e = { label: t.name, paths: new Set() }))
        e.paths.add(n.path)
      }
    }
    return out
  }

  /** Broken links: unresolved targets with the notes that contain them. */
  unresolved(): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>()
    for (const [src, links] of this.outgoing) {
      for (const l of links) {
        if (l.resolved || !l.target) continue
        let s = out.get(l.target)
        if (!s) out.set(l.target, (s = new Set()))
        s.add(src)
      }
    }
    return out
  }

  // ---------- mutations ----------

  /** Replace the whole index contents. Resolves links once at the end. */
  load(notes: NoteInput[], assets: string[] = []) {
    this.notes.clear()
    this.outgoing.clear()
    this.backlinks.clear()
    this.byTitle.clear()
    this.linkers.clear()
    this.assets.clear()
    for (const a of assets) this.assets.add(a)
    for (const n of notes) this.addNote(n)
    for (const p of this.notes.keys()) this.resolveNote(p)
    this.version++
  }

  /** Add or update one note. Returns the note. */
  upsert(input: NoteInput): Note {
    const existed = this.notes.has(input.path)
    if (existed) this.unlinkNote(input.path)
    const note = this.addNote(input)
    this.resolveNote(input.path)
    if (!existed) this.reresolveLinkers(note.title)
    this.version++
    return note
  }

  remove(path: string) {
    const note = this.notes.get(path)
    if (!note) {
      if (this.assets.delete(path)) this.version++
      return
    }
    this.unlinkNote(path)
    this.notes.delete(path)
    this.byTitle.get(note.title.toLowerCase())?.delete(path)
    this.reresolveLinkers(note.title)
    this.backlinks.delete(path)
    this.version++
  }

  addAsset(path: string) {
    this.assets.add(path)
    this.version++
  }

  private addNote({ path, text, mtime }: NoteInput): Note {
    const parsed = parseNote(text)
    const title = titleOf(path)
    const created = parseCreated(parsed.frontmatter?.data.created) ?? mtime
    const note: Note = { path, title, text, mtime, created, hash: hashText(text), parsed }
    this.notes.set(path, note)
    const key = title.toLowerCase()
    let set = this.byTitle.get(key)
    if (!set) this.byTitle.set(key, (set = new Set()))
    set.add(path)
    for (const l of parsed.links) {
      if (!l.target) continue
      const k = linkKey(l.target)
      let s = this.linkers.get(k)
      if (!s) this.linkers.set(k, (s = new Set()))
      s.add(path)
    }
    return note
  }

  /** Drop a note's outgoing links and linker registrations (the note itself stays). */
  private unlinkNote(path: string) {
    for (const l of this.outgoing.get(path) ?? []) if (l.resolved) this.backlinks.get(l.resolved)?.delete(path)
    this.outgoing.delete(path)
    const old = this.notes.get(path)
    if (old) {
      for (const l of old.parsed.links) if (l.target) this.linkers.get(linkKey(l.target))?.delete(path)
      this.byTitle.get(old.title.toLowerCase())?.delete(path)
    }
  }

  private resolveNote(path: string) {
    const note = this.notes.get(path)
    if (!note) return
    for (const l of this.outgoing.get(path) ?? []) if (l.resolved) this.backlinks.get(l.resolved)?.delete(path)
    const resolved: ResolvedLink[] = note.parsed.links.map((l) => ({ ...l, resolved: this.resolve(l.target, path) }))
    this.outgoing.set(path, resolved)
    for (const l of resolved) {
      if (!l.resolved) continue
      let s = this.backlinks.get(l.resolved)
      if (!s) this.backlinks.set(l.resolved, (s = new Set()))
      s.add(path)
    }
  }

  /** A note with this title appeared or disappeared: links to it may now resolve differently. */
  private reresolveLinkers(title: string) {
    for (const src of this.linkers.get(title.toLowerCase()) ?? []) this.resolveNote(src)
  }
}

/** Among same-named notes, prefer one in the linking note's folder, then the shortest path. */
function pickClosest(paths: string[], fromPath: string): string {
  const dir = dirname(fromPath)
  const same = paths.filter((p) => dirname(p) === dir)
  const pool = same.length ? same : paths
  return pool.sort((a, b) => a.length - b.length || a.localeCompare(b))[0]!
}

export const isNotePath = isMarkdown
