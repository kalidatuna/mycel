import type { Note } from '../core/vaultIndex'
import { useWorkspace } from '../store/workspace'

export function OutlinePanel({ note }: { note: Note }) {
  const open = useWorkspace((s) => s.open)
  const hs = note.parsed.headings
  if (!hs.length) return <p className="empty small">No headings.</p>
  const min = Math.min(...hs.map((h) => h.level))
  return (
    <ul className="outline">
      {hs.map((h, i) => (
        <li key={i} style={{ paddingLeft: (h.level - min) * 12 }}>
          <button onClick={() => open(note.path, { anchor: { offset: h.from } })}>{h.text}</button>
        </li>
      ))}
    </ul>
  )
}
