import { useEffect } from 'react'
import { GlobalKeys, Shell, Toasts } from './components/Shell'
import { StartScreen } from './components/StartScreen'
import { useUi } from './store/ui'
import { useVault } from './store/vault'

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
        <Shell />
      ) : (
        <>
          <StartScreen />
          <Toasts />
        </>
      )}
    </>
  )
}
