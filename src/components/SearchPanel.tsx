import { useDeferredValue, useEffect, useMemo, useRef } from 'react'
import type { SearchHit } from '../core/search'
import { useUi } from '../store/ui'
import { useWorkspace } from '../store/workspace'
import { session } from '../vault/session'
import { useVaultVersion } from './hooks'

/** `tag:coffee rest of query` → tag filter + text query. */
function parseQuery(q: string) {
  const tags: string[] = []
  const text = q.replace(/(?:^|\s)(?:tag:|#)([\p{L}\p{N}_\-/]+)/gu, (_, t: string) => {
    tags.push(t.toLowerCase())
    return ' '
  })
  return { tags, text: text.trim() }
}

export function SearchPanel() {
  const version = useVaultVersion()
  const query = useUi((s) => s.searchQuery)
  const setQuery = useUi((s) => s.setSearchQuery)
  const open = useWorkspace((s) => s.open)
  const deferred = useDeferredValue(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusRequest = useUi((s) => s.focusRequest)
  useEffect(() => {
    if (focusRequest?.target === 'search') inputRef.current?.select()
  }, [focusRequest])

  const { hits, ms } = useMemo(() => {
    const t0 = performance.now()
    const { tags, text } = parseQuery(deferred)
    let hits: SearchHit[] = []
    if (text) hits = session.search.search(text, 200)
    else if (tags.length) {
      hits = [...session.index.notes.values()]
        .sort((a, b) => b.mtime - a.mtime)
        .map((n) => ({ path: n.path, title: n.title, score: 0, terms: [], snippet: { parts: [{ text: n.text.slice(n.parsed.frontmatter?.end ?? 0, 160).replace(/\s+/g, ' '), hit: false }] } }))
    }
    if (tags.length) {
      hits = hits.filter((h) => {
        const n = session.index.get(h.path)
        return n && tags.every((t) => n.parsed.tags.some((x) => x.name.toLowerCase() === t || x.name.toLowerCase().startsWith(t + '/')))
      })
    }
    return { hits, ms: performance.now() - t0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, version])

  return (
    <div className="search-panel">
      <div className="panel-head">
        <span>Search</span>
      </div>
      <div className="search-box">
        <input
          id="global-search"
          ref={inputRef}
          className="input"
          type="search"
          placeholder="Search notes…  (try tag:coffee)"
          aria-label="Search all notes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              ;(document.querySelector('.search-results button') as HTMLElement | null)?.focus()
            }
          }}
        />
      </div>
      {deferred.trim() && (
        <p className="search-meta muted" aria-live="polite">
          {hits.length} result{hits.length === 1 ? '' : 's'} · {ms < 1 ? '<1' : Math.round(ms)} ms
        </p>
      )}
      <ul className="search-results scroll" aria-label="Search results">
        {hits.map((h) => (
          <li key={h.path}>
            <button
              className="result"
              onClick={(e) => open(h.path, { newTab: e.ctrlKey || e.metaKey, anchor: firstHitAnchor(h) })}
              onKeyDown={(e) => {
                const li = e.currentTarget.parentElement
                const sib = e.key === 'ArrowDown' ? li?.nextElementSibling : e.key === 'ArrowUp' ? li?.previousElementSibling : null
                if (sib) {
                  e.preventDefault()
                  ;(sib.querySelector('button') as HTMLElement | null)?.focus()
                }
              }}
            >
              <span className="result-title">{h.title}</span>
              <span className="result-path faint">{h.path.includes('/') ? h.path.slice(0, h.path.lastIndexOf('/')) : ''}</span>
              <span className="result-snippet">
                {h.snippet.parts.map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
              </span>
            </button>
          </li>
        ))}
        {deferred.trim() && hits.length === 0 && <li className="empty">No notes match “{deferred.trim()}”.</li>}
        {!deferred.trim() && <li className="empty">Type to search every note. Results update as you type.</li>}
      </ul>
    </div>
  )
}

function firstHitAnchor(h: SearchHit) {
  const note = session.index.get(h.path)
  if (!note || !h.terms.length) return undefined
  const re = new RegExp(h.terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
  const body = note.parsed.frontmatter?.end ?? 0
  const m = re.exec(note.text.slice(body))
  return m ? { offset: body + m.index } : undefined
}
