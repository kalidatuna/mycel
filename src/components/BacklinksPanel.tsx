import type { Note } from '../core/vaultIndex'
import { useWorkspace } from '../store/workspace'
import { session } from '../vault/session'
import type { SectionComponent } from './RightSidebar'

/** The line around `pos`, trimmed to ~140 chars, with the link span highlighted. */
export function contextLine(text: string, from: number, to: number) {
  const ls = text.lastIndexOf('\n', from - 1) + 1
  const nl = text.indexOf('\n', to)
  const le = nl === -1 ? text.length : nl
  let a = ls
  let b = le
  if (b - a > 140) {
    a = Math.max(ls, from - 60)
    b = Math.min(le, to + 60)
  }
  return { before: (a > ls ? '…' : '') + text.slice(a, from).replace(/^\s*[-*+>]\s+/, ''), hit: text.slice(from, to), after: text.slice(to, b) + (b < le ? '…' : '') }
}

export function BacklinksPanel({ note, Section }: { note: Note; Section: SectionComponent }) {
  const open = useWorkspace((s) => s.open)
  const sources = session.index.backlinksOf(note.path)
  return (
    <Section id="backlinks" title="Backlinks" count={sources.length}>
      {sources.length === 0 ? (
        <p className="empty small">No notes link here yet.</p>
      ) : (
        <ul className="ref-list">
          {sources.map((src) => {
            const s = session.index.get(src)!
            const links = session.index.linksBetween(src, note.path)
            return (
              <li key={src}>
                <button className="ref-title" onClick={(e) => open(src, { newTab: e.ctrlKey || e.metaKey })}>
                  {s.title}
                </button>
                {links.slice(0, 3).map((l, i) => {
                  const c = contextLine(s.text, l.from, l.to)
                  return (
                    <button key={i} className="ref-context" onClick={() => open(src, { anchor: { offset: l.from } })}>
                      {c.before}
                      <mark>{c.hit}</mark>
                      {c.after}
                    </button>
                  )
                })}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
