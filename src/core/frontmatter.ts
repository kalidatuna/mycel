import { parse as parseYaml } from 'yaml'

export interface Frontmatter {
  /** YAML source between the fences, exactly as written. */
  raw: string
  data: Record<string, unknown>
  /** Offset where the YAML content starts (after the opening fence line). */
  contentFrom: number
  /** Offset where the YAML content ends (start of the closing fence line). */
  contentTo: number
  /** Offset just after the closing fence line: where the body starts. */
  end: number
  error?: string
}

const OPEN = /^---[ \t]*\r?\n/
const FENCE = /^(?:---|\.\.\.)[ \t]*\r?$/

export function findFrontmatter(text: string): Frontmatter | null {
  const open = OPEN.exec(text)
  if (!open) return null
  const contentFrom = open[0].length
  let pos = contentFrom
  for (;;) {
    const nl = text.indexOf('\n', pos)
    const lineEnd = nl === -1 ? text.length : nl
    if (FENCE.test(text.slice(pos, lineEnd))) {
      const raw = text.slice(contentFrom, pos)
      let data: Record<string, unknown> = {}
      let error: string | undefined
      try {
        const parsed: unknown = parseYaml(raw, { logLevel: 'error' })
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
      } catch (e) {
        error = e instanceof Error ? e.message.split('\n')[0] : String(e)
      }
      return { raw, data, contentFrom, contentTo: pos, end: nl === -1 ? text.length : nl + 1, error }
    }
    if (nl === -1) return null
    pos = nl + 1
  }
}

/** Normalize a frontmatter list-ish value (array, comma/space separated string) to strings. */
export function toStringList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.flatMap(toStringList)
  if (typeof value === 'string') return value.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
  return []
}

/** Aliases are a list but may contain spaces, so commas are the only separator for strings. */
export function toAliasList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.filter((v) => v != null).map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

const needsQuotes = (v: string) => v === '' || /^[\s>|!&*%@`'"{}[\],?-]|:\s|\s#|\s$|^(true|false|null|yes|no|~)$/i.test(v)

export const formatScalar = (v: string) => (needsQuotes(v) ? JSON.stringify(v) : v)

/**
 * Set a top-level scalar property by splicing only that line. Everything else in the file,
 * including comments and formatting inside the frontmatter, is left untouched.
 */
export function setFrontmatterScalar(text: string, key: string, value: string): string {
  const fm = findFrontmatter(text)
  const line = `${key}: ${formatScalar(value)}`
  if (!fm) return `---\n${line}\n---\n${text}`
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*:[^\\n]*$`, 'm')
  const m = re.exec(fm.raw)
  if (m) {
    const from = fm.contentFrom + m.index
    const lineEnd = from + m[0].length
    const cr = text[lineEnd - 1] === '\r' ? '\r' : ''
    return text.slice(0, from) + line + cr + text.slice(lineEnd)
  }
  const nl = fm.raw.length === 0 || fm.raw.endsWith('\n') ? '' : '\n'
  return text.slice(0, fm.contentTo) + nl + line + '\n' + text.slice(fm.contentTo)
}
