import { EditorSelection } from '@codemirror/state'
import type { EditorView, KeyBinding } from '@codemirror/view'

/** Wrap each selection in `marker`, or unwrap if already wrapped. */
export function toggleWrap(view: EditorView, marker: string): boolean {
  const { state } = view
  const len = marker.length
  view.dispatch(
    state.changeByRange((r) => {
      const before = state.sliceDoc(r.from - len, r.from)
      const after = state.sliceDoc(r.to, r.to + len)
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: r.from - len, to: r.from, insert: '' },
            { from: r.to, to: r.to + len, insert: '' },
          ],
          range: EditorSelection.range(r.from - len, r.to - len),
        }
      }
      return {
        changes: [
          { from: r.from, insert: marker },
          { from: r.to, insert: marker },
        ],
        range: EditorSelection.range(r.from + len, r.to + len),
      }
    }),
  )
  return true
}

export const formattingKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: (v) => toggleWrap(v, '**') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
  { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~') },
]

export function insertAtCursor(view: EditorView, text: string) {
  const { from, to } = view.state.selection.main
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true })
  view.focus()
}
