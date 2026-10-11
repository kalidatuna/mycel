import { useMemo } from 'react'
import { unlinkedMentions } from '../core/mentions'
import type { Note } from '../core/vaultIndex'
import { useWorkspace } from '../store/workspace'
import { linkMention } from '../vault/actions'
import { session } from '../vault/session'
import { contextLine } from './BacklinksPanel'
import { useVaultVersion } from './hooks'
import { Icon } from './Icon'
import type { SectionComponent } from './RightSidebar'

export function MentionsPanel({ note, Section }: { note: Note; Section: SectionComponent }) {
  const version = useVaultVersion()
  const open = useWorkspace((s) => s.open)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mentions = useMemo(() => unlinkedMentions(session.index, note.path), [note.path, version])
  return (
    <Section id="mentions" title="Unlinked mentions" count={mentions.length}>
      {mentions.length === 0 ? (
        <p className="empty small">No other note mentions “{note.title}” without linking it.</p>
      ) : (
        <ul className="ref-list">
          {mentions.map((m) => {
            const src = session.index.get(m.source)!
            const c = contextLine(src.text, m.from, m.to)
            return (
              <li key={`${m.source}:${m.from}`} className="mention">
                <button className="ref-title" onClick={() => open(m.source, { anchor: { offset: m.from } })}>
                  {src.title}
                </button>
                <div className="mention-row">
                  <span className="ref-context static">
                    {c.before}
                    <mark>{c.hit}</mark>
                    {c.after}
                  </span>
                  <button className="btn small link-it" onClick={() => linkMention(m.source, m.from, m.to, m.match, note.title)} aria-label={`Link this mention in ${src.title}`}>
                    <Icon name="link" size={13} /> Link it
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
