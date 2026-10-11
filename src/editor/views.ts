import type { EditorView } from '@codemirror/view'
import { useWorkspace } from '../store/workspace'

/** Live EditorView per pane id, so commands can act on the focused editor. */
const views = new Map<string, EditorView>()

export const registerView = (paneId: string, view: EditorView | null) => (view ? views.set(paneId, view) : views.delete(paneId))

export function activeView(): EditorView | null {
  const { panes, activePane } = useWorkspace.getState()
  const p = panes[activePane]
  return p ? (views.get(p.id) ?? null) : null
}

export function activePath(): string | null {
  const { panes, activePane } = useWorkspace.getState()
  return panes[activePane]?.active ?? null
}
