import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PickItem } from '../store/ui'

/** Subsequence fuzzy score: higher is better, null when not a match. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (!q) return 0
  const direct = t.indexOf(q)
  if (direct !== -1) return 1000 - direct * 2 - t.length * 0.1 + (direct === 0 || t[direct - 1] === ' ' || t[direct - 1] === '/' ? 50 : 0)
  let score = 0
  let ti = 0
  let streak = 0
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found === -1) return null
    streak = found === ti ? streak + 1 : 0
    score += 10 + streak * 5 - (found - ti)
    ti = found + 1
  }
  return score - t.length * 0.1
}

interface Props {
  title: string
  placeholder: string
  items: PickItem[]
  onPick(item: PickItem, e: { mod: boolean }): void
  onClose(): void
  /** Extra entry shown when nothing matches (e.g. "Create note"). */
  createLabel?: (q: string) => string | null
  onCreate?: (q: string) => void
  footer?: ReactNode
  limit?: number
}

export function QuickPick({ title, placeholder, items, onPick, onClose, createLabel, onCreate, footer, limit = 60 }: Props) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    if (!q.trim()) return items.slice(0, limit)
    const scored: { it: PickItem; s: number }[] = []
    for (const it of items) {
      const s = fuzzyScore(q.trim(), it.label)
      const d = it.detail ? fuzzyScore(q.trim(), it.detail) : null
      const best = Math.max(s ?? -Infinity, d != null ? d - 200 : -Infinity)
      if (best > -Infinity) scored.push({ it, s: best })
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.it)
  }, [q, items, limit])

  const create = createLabel && q.trim() ? createLabel(q.trim()) : null
  const count = results.length + (create ? 1 : 0)
  const selIdx = Math.min(sel, Math.max(0, count - 1))

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  }, [selIdx])

  const choose = (i: number, mod: boolean) => {
    if (i < results.length) onPick(results[i]!, { mod })
    else if (create && onCreate) onCreate(q.trim())
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal quick-pick" role="dialog" aria-modal="true" aria-label={title}>
        <input
          autoFocus
          className="qp-input"
          placeholder={placeholder}
          value={q}
          role="combobox"
          aria-expanded="true"
          aria-controls="qp-list"
          aria-activedescendant={count ? `qp-${selIdx}` : undefined}
          onChange={(e) => {
            setQ(e.target.value)
            setSel(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setSel((selIdx + 1) % Math.max(1, count))
            else if (e.key === 'ArrowUp') setSel((selIdx - 1 + count) % Math.max(1, count))
            else if (e.key === 'Enter') choose(selIdx, e.ctrlKey || e.metaKey)
            else if (e.key === 'Escape') onClose()
            else return
            e.preventDefault()
          }}
        />
        <ul id="qp-list" ref={listRef} className="qp-list scroll" role="listbox" aria-label={title}>
          {results.map((it, i) => (
            <li
              key={it.id}
              id={`qp-${i}`}
              role="option"
              aria-selected={i === selIdx}
              className="qp-item"
              onMouseMove={() => i !== selIdx && setSel(i)}
              onClick={(e) => choose(i, e.ctrlKey || e.metaKey)}
            >
              <span className="qp-label">{it.label}</span>
              {it.detail && <span className="qp-detail">{it.detail}</span>}
              {it.hint && <kbd>{it.hint}</kbd>}
            </li>
          ))}
          {create && (
            <li id={`qp-${results.length}`} role="option" aria-selected={selIdx === results.length} className="qp-item create" onClick={() => choose(results.length, false)}>
              <span className="qp-label">{create}</span>
            </li>
          )}
          {count === 0 && <li className="empty">No matches</li>}
        </ul>
        {footer && <div className="qp-footer">{footer}</div>}
      </div>
    </div>
  )
}
