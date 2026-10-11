import { useState, type ReactNode } from 'react'
import { useActiveNote } from './hooks'
import { BacklinksPanel } from './BacklinksPanel'
import { MentionsPanel } from './MentionsPanel'
import { OutlinePanel } from './OutlinePanel'
import { PropertiesPanel } from './PropertiesPanel'
import { Icon } from './Icon'

function Section({ id, title, count, children, defaultOpen = true }: { id: string; title: string; count?: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rs-section" aria-labelledby={`rs-${id}`}>
      <h2 id={`rs-${id}`}>
        <button className="rs-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="chevron" size={13} className={'chev' + (open ? ' open' : '')} />
          {title}
          {count != null && <span className="count">{count}</span>}
        </button>
      </h2>
      {open && <div className="rs-body">{children}</div>}
    </section>
  )
}

export function RightSidebar() {
  const note = useActiveNote()
  if (!note) return <aside className="right-sidebar" aria-label="Note details"><p className="empty">Open a note to see its links and properties.</p></aside>
  return (
    <aside className="right-sidebar scroll" aria-label="Note details">
      <Section id="props" title="Properties">
        <PropertiesPanel note={note} />
      </Section>
      <BacklinksPanel note={note} Section={Section} />
      <MentionsPanel note={note} Section={Section} />
      <Section id="outline" title="Outline" count={note.parsed.headings.length} defaultOpen={false}>
        <OutlinePanel note={note} />
      </Section>
    </aside>
  )
}

export type SectionComponent = typeof Section
