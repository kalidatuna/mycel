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
