import MiniSearch, { type SearchResult } from 'minisearch'
import type { Note } from './vaultIndex'

interface Doc {
  id: string
  title: string
  body: string
  tags: string
}

export interface Snippet {
  /** Alternating plain and highlighted parts, safe to render as text. */
  parts: { text: string; hit: boolean }[]
}

export interface SearchHit {
  path: string
  title: string
  score: number
  terms: string[]
  snippet: Snippet
}

const toDoc = (n: Note): Doc => ({
  id: n.path,
  title: n.title + ' ' + n.parsed.aliases.join(' '),
  body: n.text.slice(n.parsed.frontmatter?.end ?? 0),
  tags: n.parsed.tags.map((t) => t.name.replace(/\//g, ' ')).join(' '),
})

/** Full-text index over notes. Incremental: call `update`/`remove` on change. */
export class TextSearch {
  private ms = new MiniSearch<Doc>({
    fields: ['title', 'body', 'tags'],
    searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
  })
  private hashes = new Map<string, string>()
  private texts = new Map<string, Note>()

  build(notes: Iterable<Note>) {
    this.ms.removeAll()
    this.hashes.clear()
    this.texts.clear()
    const docs: Doc[] = []
    for (const n of notes) {
      docs.push(toDoc(n))
      this.hashes.set(n.path, n.hash)
      this.texts.set(n.path, n)
    }
    this.ms.addAll(docs)
  }

  update(note: Note) {
    if (this.hashes.get(note.path) === note.hash) return
    if (this.hashes.has(note.path)) this.ms.discard(note.path)
    this.ms.add(toDoc(note))
    this.hashes.set(note.path, note.hash)
    this.texts.set(note.path, note)
  }

  remove(path: string) {
    if (!this.hashes.has(path)) return
    this.ms.discard(path)
    this.hashes.delete(path)
    this.texts.delete(path)
  }

  search(query: string, limit = 50): SearchHit[] {
    const q = query.trim()
    if (!q) return []
    const results: SearchResult[] = this.ms.search(q).slice(0, limit)
    return results.map((r) => {
      const note = this.texts.get(r.id as string)
      const body = note ? note.text.slice(note.parsed.frontmatter?.end ?? 0) : ''
      return { path: r.id as string, title: note?.title ?? String(r.id), score: r.score, terms: r.terms, snippet: makeSnippet(body, r.terms) }
    })
  }
}

/** A ~160 char window around the first matching term, with every term occurrence marked. */
export function makeSnippet(body: string, terms: string[], width = 160): Snippet {
  const clean = body.replace(/\s+/g, ' ').trim()
  if (!terms.length) return { parts: [{ text: clean.slice(0, width), hit: false }] }
  const re = new RegExp(terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|'), 'giu')
  const first = re.exec(clean)
  re.lastIndex = 0
  let start = first ? Math.max(0, first.index - Math.floor(width / 3)) : 0
  if (start > 0) {
    const space = clean.indexOf(' ', start)
    if (space !== -1 && space < (first?.index ?? 0)) start = space + 1
  }
  const end = Math.min(clean.length, start + width)
  const window = clean.slice(start, end)
  const parts: Snippet['parts'] = []
  if (start > 0) parts.push({ text: '…', hit: false })
  let pos = 0
  for (const m of window.matchAll(re)) {
    if (m.index > pos) parts.push({ text: window.slice(pos, m.index), hit: false })
    parts.push({ text: m[0], hit: true })
    pos = m.index + m[0].length
  }
  if (pos < window.length) parts.push({ text: window.slice(pos), hit: false })
  if (end < clean.length) parts.push({ text: '…', hit: false })
  return { parts }
}
