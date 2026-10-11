import { create } from 'zustand'

export type Theme = 'light' | 'dark'

export interface PickItem {
  id: string
  label: string
  detail?: string
  hint?: string
}

export type Modal =
  | { kind: 'switcher' }
  | { kind: 'palette' }
  | { kind: 'pick'; title: string; items: PickItem[]; resolve: (v: PickItem | null) => void }
  | { kind: 'prompt'; title: string; initial: string; okLabel: string; select?: [number, number]; resolve: (v: string | null) => void }
  | { kind: 'confirm'; title: string; body: string; okLabel: string; danger?: boolean; resolve: (v: boolean) => void }

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'error' | 'success'
}

export type LeftTab = 'files' | 'search' | 'tags'

interface UiState {
  theme: Theme
  leftTab: LeftTab
  leftOpen: boolean
  rightOpen: boolean
  modal: Modal | null
  toasts: Toast[]
  searchQuery: string
  /** Bumped to ask a panel to take keyboard focus once it has rendered. */
  focusRequest: { target: 'search' | 'tree'; seq: number } | null
  requestFocus(target: 'search' | 'tree'): void
  setTheme(t: Theme): void
  setLeftTab(t: LeftTab): void
  toggleLeft(): void
  toggleRight(): void
  setSearchQuery(q: string): void
  openModal(m: Modal | null): void
  toast(text: string, kind?: Toast['kind']): void
  dismissToast(id: number): void
}

const initialTheme = (): Theme => {
  try {
    const t = localStorage.getItem('mycel.theme')
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* storage unavailable */
  }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let toastId = 0

export const useUi = create<UiState>((set, get) => ({
  theme: initialTheme(),
  leftTab: 'files',
  leftOpen: true,
  rightOpen: true,
  modal: null,
  toasts: [],
  searchQuery: '',
  focusRequest: null,
  requestFocus: (target) => set({ focusRequest: { target, seq: (get().focusRequest?.seq ?? 0) + 1 } }),
  setTheme(theme) {
    try {
      localStorage.setItem('mycel.theme', theme)
    } catch {
      /* ignore */
    }
    set({ theme })
  },
  setLeftTab: (leftTab) => set({ leftTab, leftOpen: true }),
  toggleLeft: () => set({ leftOpen: !get().leftOpen }),
  toggleRight: () => set({ rightOpen: !get().rightOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  openModal: (modal) => set({ modal }),
  toast(text, kind = 'info') {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, text, kind }] })
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

/** Promise-based dialogs, usable from commands. */
export const dialogs = {
  prompt(title: string, initial = '', okLabel = 'OK', select?: [number, number]) {
    return new Promise<string | null>((resolve) => useUi.getState().openModal({ kind: 'prompt', title, initial, okLabel, select, resolve }))
  },
  pick(title: string, items: PickItem[]) {
    return new Promise<PickItem | null>((resolve) => useUi.getState().openModal({ kind: 'pick', title, items, resolve }))
  },
  confirm(title: string, body: string, okLabel = 'OK', danger = false) {
    return new Promise<boolean>((resolve) => useUi.getState().openModal({ kind: 'confirm', title, body, okLabel, danger, resolve }))
  },
}

export const toast = (text: string, kind?: Toast['kind']) => useUi.getState().toast(text, kind)
