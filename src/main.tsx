import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { registerBuiltins } from './commands/builtin'
import { flushAll, hasPending } from './editor/pending'
import { openDemoVault } from './vault/loader'
import './styles/tokens.css'
import './styles/base.css'
import './styles/app.css'
import './styles/editor.css'

registerBuiltins()

// Test/debug hook (development builds only): lets end-to-end tests read files from the vault.
if (import.meta.env.DEV) {
  void Promise.all([import('./vault/session'), import('./vault/loader'), import('./fs/fsAccess')]).then(([{ session }, { openVault }, { FsAccessFS }]) => {
    ;(window as unknown as { __mycel: unknown }).__mycel = {
      read: (p: string) => session.fs?.read(p).then((r) => r.text),
      exists: (p: string) => session.fs?.exists(p),
      openHandle: (h: FileSystemDirectoryHandle) => openVault(new FsAccessFS(h)),
    }
  })
}

// Save in-flight edits when the tab is hidden or closed.
addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void flushAll())
addEventListener('beforeunload', (e) => {
  if (!hasPending()) return
  void flushAll()
  e.preventDefault()
})

if (new URLSearchParams(location.search).has('demo')) void openDemoVault()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
