import { TextSearch } from '../core/search'
import { VaultIndex } from '../core/vaultIndex'
import type { VaultFS } from '../fs/types'
import type { VaultWatcher } from '../fs/watcher'

/** The open vault. One per tab; replaced when another vault is opened. */
export const session = {
  fs: null as VaultFS | null,
  index: new VaultIndex(),
  search: new TextSearch(),
  watcher: null as VaultWatcher | null,
  folders: new Set<string>(),
}

export function requireFs(): VaultFS {
  if (!session.fs) throw new Error('No vault is open')
  return session.fs
}
