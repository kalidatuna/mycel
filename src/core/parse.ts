import { findFrontmatter, toAliasList, toStringList, type Frontmatter } from './frontmatter'

export interface Link {
  /** The whole `[[...]]` (or `![[...]]`) as written. */
  raw: string
  target: string
  heading?: string
  alias?: string
  embed: boolean
  from: number
  to: number
  /** Span of the target text inside the link, for rewriting on rename. */
  targetFrom: number
  targetTo: number
}

export interface Tag {
  /** Without the leading '#', original casing. */
  name: string
  from: number
  to: number
  source: 'inline' | 'frontmatter'
}

export interface Heading {
  level: number
  text: string
  from: number
  to: number
}

export interface ParsedNote {
  frontmatter: Frontmatter | null
  links: Link[]
  tags: Tag[]
  headings: Heading[]
  aliases: string[]
  /** Ranges the parser ignores: frontmatter, fenced/inline code, HTML comments. */
  skipped: [number, number][]
}

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})/

/** Returns ranges of fenced code, inline code and HTML comments (plus frontmatter). */
function skippedRanges(text: string, bodyStart: number): [number, number][] {
  const out: [number, number][] = bodyStart > 0 ? [[0, bodyStart]] : []
  let pos = bodyStart
  let fence: { char: string; len: number; from: number } | null = null
  const inline: [number, number][] = []
  while (pos < text.length) {
    const nl = text.indexOf('\n', pos)
    const end = nl === -1 ? text.length : nl
    const line = text.slice(pos, end)
    if (fence) {
      const m = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)
      if (m && m[1]![0] === fence.char && m[1]!.length >= fence.len) {
        out.push([fence.from, end])
        fence = null
      }
    } else {
      const m = FENCE_OPEN.exec(line)
      if (m) fence = { char: m[2]![0]!, len: m[2]!.length, from: pos }
      else inline.push([pos, end])
    }
    pos = end + 1
  }
  if (fence) out.push([fence.from, text.length])
  // Inline code and comments, only on lines outside fences.
  for (const [from, to] of inline) {
    const line = text.slice(from, to)
    const re = /(`+)[^`]*?\1|<!--[\s\S]*?-->/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) out.push([from + m.index, from + m.index + m[0].length])
  }
  // Multi-line HTML comments.
  const cre = /<!--[\s\S]*?-->/g
  let m: RegExpExecArray | null
  cre.lastIndex = bodyStart
  while ((m = cre.exec(text))) if (m[0].includes('\n')) out.push([m.index, m.index + m[0].length])
  return out.sort((a, b) => a[0] - b[0])
}

/** Replace skipped ranges with spaces so regexes can run on the result with the same offsets. */
export function blankRanges(text: string, ranges: [number, number][]): string {
  if (!ranges.length) return text
  let out = ''
  let pos = 0
  for (const [from, to] of ranges) {
    if (to <= pos) continue
    const f = Math.max(from, pos)
    out += text.slice(pos, f) + text.slice(f, to).replace(/[^\n]/g, ' ')
    pos = to
  }
  return out + text.slice(pos)
}

const LINK_RE = /(!?)\[\[([^[\]\n]+?)\]\]/g
const TAG_RE = /(^|[\s([{,;:!?"'])#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu
const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm

export function parseLinkInner(inner: string, innerFrom: number) {
  const pipe = inner.indexOf('|')
  const targetPart = pipe === -1 ? inner : inner.slice(0, pipe)
  const alias = pipe === -1 ? undefined : inner.slice(pipe + 1).trim() || undefined
  const hash = targetPart.indexOf('#')
  const rawTarget = hash === -1 ? targetPart : targetPart.slice(0, hash)
  const heading = hash === -1 ? undefined : targetPart.slice(hash + 1).trim() || undefined
  const lead = rawTarget.length - rawTarget.trimStart().length
  const target = rawTarget.trim()
  return { target, heading, alias, targetFrom: innerFrom + lead, targetTo: innerFrom + lead + target.length }
}

export function parseNote(text: string): ParsedNote {
  const frontmatter = findFrontmatter(text)
  const bodyStart = frontmatter?.end ?? 0
  const skipped = skippedRanges(text, bodyStart)
  const body = blankRanges(text, skipped)

  const links: Link[] = []
  for (const m of body.matchAll(LINK_RE)) {
    const from = m.index
    const embed = m[1] === '!'
    const innerFrom = from + (embed ? 3 : 2)
    links.push({ raw: m[0], embed, from, to: from + m[0].length, ...parseLinkInner(m[2]!, innerFrom) })
  }

  // Blank links before looking for tags so `[[Note#Heading]]` is not read as a tag.
  const noLinks = blankRanges(body, links.map((l) => [l.from, l.to]))
  const tags: Tag[] = []
  if (frontmatter) {
    const fmTags = [...toStringList(frontmatter.data.tags), ...toStringList(frontmatter.data.tag)]
    for (const t of fmTags) {
      const name = t.replace(/^#/, '')
      if (name) tags.push({ name, from: frontmatter.contentFrom, to: frontmatter.contentTo, source: 'frontmatter' })
    }
  }
  for (const m of noLinks.matchAll(TAG_RE)) {
    const name = m[2]!.replace(/\/+$/, '')
    if (!name) continue
    const from = m.index + m[1]!.length
    tags.push({ name, from, to: from + 1 + name.length, source: 'inline' })
  }

  const headings: Heading[] = []
  for (const m of body.matchAll(HEADING_RE)) {
    headings.push({ level: m[1]!.length, text: m[2]!, from: m.index, to: m.index + m[0].length })
  }

  const aliases = frontmatter ? [...toAliasList(frontmatter.data.aliases), ...toAliasList(frontmatter.data.alias)] : []
  return { frontmatter, links, tags, headings, aliases, skipped }
}

/** Parse a frontmatter `created` value into ms, if it looks like a date. */
export function parseCreated(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const t = Date.parse(String(value))
  return Number.isNaN(t) ? null : t
}
