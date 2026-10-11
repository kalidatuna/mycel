import { useVault } from '../store/vault'
import { useWorkspace } from '../store/workspace'
import { session } from '../vault/session'

/** Re-render whenever the vault index changes. */
export const useVaultVersion = () => useVault((s) => s.version)

/** The note open in the focused pane (re-renders on index changes). */
export function useActiveNote() {
  useVaultVersion()
  const path = useWorkspace((s) => s.panes[s.activePane]?.active ?? null)
  return path ? (session.index.get(path) ?? null) : null
}
