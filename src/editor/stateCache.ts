import type { EditorState } from '@codemirror/state'
import { create } from 'zustand'

/** One open document in one pane. Kept across tab switches so undo history survives. */
export interface DocEntry {
  state: EditorState
  /** Mutable so a rename doesn't strand the save callback on the old path. */
  holder: { path: string }
  /** The text last known to match the file on disk. */
  synced: string
}

const entries = new Map<string, DocEntry>()
const key = (paneId: string, path: string) => `${paneId}\u0000${path}`

export const docCache = {
  get: (paneId: string, path: string) => entries.get(key(paneId, path)),
  set: (paneId: string, path: string, e: DocEntry) => entries.set(key(paneId, path), e),
  delete: (paneId: string, path: string) => entries.delete(key(paneId, path)),
  /** Keep only entries for tabs that are still open in this pane. */
  prune(paneId: string, keep: string[]) {
    const k = new Set(keep.map((p) => key(paneId, p)))
    for (const id of entries.keys()) if (id.startsWith(paneId + '\u0000') && !k.has(id)) entries.delete(id)
  },
  /** Re-key entries after a note or folder rename. */
  rename(from: string, to: string) {
    for (const [id, e] of [...entries]) {
      const [pane, path] = id.split('\u0000') as [string, string]
      const next = path === from ? to : path.startsWith(from + '/') ? to + path.slice(from.length) : null
      if (next == null) continue
      entries.delete(id)
      e.holder.path = next
      entries.set(key(pane, next), e)
    }
  },
}

export type SaveState = 'saved' | 'pending' | 'saving' | 'error'
export const useSaveState = create<{ state: SaveState; set(s: SaveState): void }>((set) => ({ state: 'saved', set: (state) => set({ state }) }))
