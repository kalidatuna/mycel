import { create } from 'zustand'

export interface Pane {
  id: string
  tabs: string[]
  active: string | null
}

export interface Anchor {
  path: string
  heading?: string
  offset?: number
}

interface WorkspaceState {
  panes: Pane[]
  activePane: number
  /** Where to scroll once a note is shown (heading or offset). Consumed by the editor. */
  anchor: Anchor | null
  open(path: string, opts?: { newTab?: boolean; pane?: number; anchor?: Omit<Anchor, 'path'> }): void
  close(paneIdx: number, path: string): void
  closeActive(): void
  focusPane(idx: number): void
  split(): void
  closePane(idx: number): void
  cycleTab(dir: 1 | -1): void
  renamePath(from: string, to: string): void
  removePath(path: string): void
  clearAnchor(): void
  reset(panes?: Pane[]): void
}

let paneSeq = 0
const newPane = (tabs: string[] = [], active: string | null = null): Pane => ({ id: `p${++paneSeq}`, tabs, active })

const KEY = 'mycel.workspace'

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  panes: [newPane()],
  activePane: 0,
  anchor: null,

  open(path, opts = {}) {
    const { panes } = get()
    const idx = Math.min(opts.pane ?? get().activePane, panes.length - 1)
    const next = panes.map((p, i) => {
      if (i !== idx) return p
      if (p.tabs.includes(path)) return { ...p, active: path }
      const tabs = [...p.tabs]
      const at = p.active ? tabs.indexOf(p.active) : -1
      if (opts.newTab || at === -1) tabs.splice(at + 1, 0, path)
      else tabs[at] = path // replace the current tab, like following a link
      return { ...p, tabs, active: path }
    })
    set({ panes: next, activePane: idx, anchor: opts.anchor ? { path, ...opts.anchor } : null })
  },

  close(paneIdx, path) {
    const panes = get().panes.map((p, i) => {
      if (i !== paneIdx) return p
      const at = p.tabs.indexOf(path)
      const tabs = p.tabs.filter((t) => t !== path)
      const active = p.active === path ? (tabs[Math.min(at, tabs.length - 1)] ?? null) : p.active
      return { ...p, tabs, active }
    })
    set({ panes })
  },

  closeActive() {
    const { panes, activePane } = get()
    const p = panes[activePane]
    if (p?.active) get().close(activePane, p.active)
    else if (panes.length > 1) get().closePane(activePane)
  },

  focusPane: (idx) => set({ activePane: idx }),

  split() {
    const { panes, activePane } = get()
    if (panes.length >= 2) return set({ activePane: activePane === 0 ? 1 : 0 })
    const cur = panes[activePane]!
    set({ panes: [...panes, newPane(cur.active ? [cur.active] : [], cur.active)], activePane: panes.length })
  },

  closePane(idx) {
    const panes = get().panes.filter((_, i) => i !== idx)
    set({ panes: panes.length ? panes : [newPane()], activePane: 0 })
  },

  cycleTab(dir) {
    const { panes, activePane } = get()
    const p = panes[activePane]
    if (!p || p.tabs.length < 2 || !p.active) return
    const i = (p.tabs.indexOf(p.active) + dir + p.tabs.length) % p.tabs.length
    set({ panes: panes.map((x, j) => (j === activePane ? { ...x, active: p.tabs[i]! } : x)) })
  },

  renamePath(from, to) {
    const map = (t: string) => (t === from ? to : t.startsWith(from + '/') ? to + t.slice(from.length) : t)
    set({ panes: get().panes.map((p) => ({ ...p, tabs: p.tabs.map(map), active: p.active && map(p.active) })) })
  },

  removePath(path) {
    const gone = (t: string) => t === path || t.startsWith(path + '/')
    set({
      panes: get().panes.map((p) => {
        const tabs = p.tabs.filter((t) => !gone(t))
        return { ...p, tabs, active: p.active && gone(p.active) ? (tabs[0] ?? null) : p.active }
      }),
    })
  },

  clearAnchor: () => set({ anchor: null }),
  reset: (panes) => set({ panes: panes?.length ? panes : [newPane()], activePane: 0, anchor: null }),
}))

/** Persist open tabs per vault so a reload restores the workspace. */
export function persistWorkspace(vaultName: string) {
  return useWorkspace.subscribe((s) => {
    try {
      localStorage.setItem(`${KEY}.${vaultName}`, JSON.stringify(s.panes.map((p) => ({ tabs: p.tabs, active: p.active }))))
    } catch {
      /* ignore */
    }
  })
}

export function restoreWorkspace(vaultName: string, exists: (p: string) => boolean) {
  try {
    const raw = localStorage.getItem(`${KEY}.${vaultName}`)
    if (!raw) return false
    const saved = JSON.parse(raw) as { tabs: string[]; active: string | null }[]
    const panes = saved
      .map((p) => {
        const tabs = p.tabs.filter(exists)
        return newPane(tabs, p.active && exists(p.active) ? p.active : (tabs[0] ?? null))
      })
      .filter((p) => p.tabs.length)
    if (!panes.length) return false
    useWorkspace.getState().reset(panes)
    return true
  } catch {
    return false
  }
}
