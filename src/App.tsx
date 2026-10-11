import { lazy, Suspense, useEffect } from 'react'
import { GlobalKeys, Toasts } from './components/Overlay'
import { StartScreen } from './components/StartScreen'
import { useUi } from './store/ui'
import { useVault } from './store/vault'

// The editor, panels and CodeMirror load only once a vault is open, keeping the start screen light.
const Shell = lazy(() => import('./components/Shell').then((m) => ({ default: m.Shell })))

export function App() {
  const status = useVault((s) => s.status)
  const theme = useUi((s) => s.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return (
    <>
      <GlobalKeys />
      {status === 'ready' ? (
        <Suspense fallback={null}>
          <Shell />
        </Suspense>
      ) : (
        <>
          <StartScreen />
          <Toasts />
        </>
      )}
    </>
  )
}
