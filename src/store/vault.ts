import { create } from 'zustand'

export type VaultStatus = 'start' | 'loading' | 'ready' | 'error'

interface VaultState {
  status: VaultStatus
  name: string
  kind: 'folder' | 'memory' | null
  /** Bumped on every index change. Components subscribe to this, then read the session index. */
  version: number
  folders: string[]
  progress: { done: number; total: number }
  error: string | null
  loadMs: number
  set(p: Partial<Omit<VaultState, 'set' | 'bump'>>): void
  bump(): void
}

export const useVault = create<VaultState>((set, get) => ({
  status: 'start',
  name: '',
  kind: null,
  version: 0,
  folders: [],
  progress: { done: 0, total: 0 },
  error: null,
  loadMs: 0,
  set: (p) => set(p),
  bump: () => set({ version: get().version + 1 }),
}))
