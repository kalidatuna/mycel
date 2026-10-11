import { useState } from 'react'
import { setFrontmatterScalar } from '../core/frontmatter'
import type { Note } from '../core/vaultIndex'
import { flushAll } from '../editor/pending'
import { toast, useUi } from '../store/ui'
import { useWorkspace } from '../store/workspace'
import { saveNote } from '../vault/actions'
import { session } from '../vault/session'

const isScalar = (v: unknown) => v == null || ['string', 'number', 'boolean'].includes(typeof v)
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

function ScalarField({ note, k, value }: { note: Note; k: string; value: unknown }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = value == null ? '' : String(value)
  const commit = async () => {
    if (draft == null || draft === shown) return setDraft(null)
    try {
      await flushAll()
      const fresh = session.index.get(note.path)
      if (fresh) await saveNote(note.path, setFrontmatterScalar(fresh.text, k, draft))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
    setDraft(null)
  }
  return (
    <input
      className="prop-input"
      aria-label={`Property ${k}`}
      value={draft ?? shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setDraft(null)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

export function PropertiesPanel({ note }: { note: Note }) {
  const open = useWorkspace((s) => s.open)
  const fm = note.parsed.frontmatter
  const words = note.text.slice(fm?.end ?? 0).split(/\s+/).filter(Boolean).length
  const showTag = (t: string) => {
    useUi.getState().setSearchQuery(`tag:${t}`)
    useUi.getState().setLeftTab('search')
  }
  const jump = () => open(note.path, { anchor: { offset: fm?.contentFrom ?? 0 } })
  return (
    <div className="props">
      {fm?.error && (
        <p className="banner warn small" role="alert">
          Frontmatter has a YAML error, shown as-is: {fm.error}
        </p>
      )}
      {fm && Object.keys(fm.data).length > 0 ? (
        <dl>
          {Object.entries(fm.data).map(([k, v]) => (
            <div className="prop" key={k}>
              <dt title={k}>{k}</dt>
              <dd>
                {k === 'tags' || k === 'tag' ? (
                  <span className="chips">
                    {(Array.isArray(v) ? v : String(v ?? '').split(/[,\s]+/)).filter(Boolean).map((t) => (
                      <button key={String(t)} className="tag-pill" onClick={() => showTag(String(t).replace(/^#/, ''))}>
                        #{String(t).replace(/^#/, '')}
                      </button>
                    ))}
                  </span>
                ) : isScalar(v) ? (
                  <ScalarField note={note} k={k} value={v} />
                ) : Array.isArray(v) && v.every(isScalar) ? (
                  <span className="chips">
                    {v.map((x, i) => (
                      <span key={i} className="chip">
                        {String(x)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <button className="link-btn" onClick={jump} title="Nested value: edit it in the note">
                    {JSON.stringify(v).slice(0, 40)}…
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="empty small">No frontmatter properties.</p>
      )}
      <p className="file-info faint">
        {words.toLocaleString()} words · created {fmtDate(note.created)} · edited {fmtDate(note.mtime)}
      </p>
    </div>
  )
}
