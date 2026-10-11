import { useEffect } from 'react'
import { commandForEvent } from '../commands/registry'
import { useUi } from '../store/ui'
import { Icon } from './Icon'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>
          <span>{t.text}</span>
          <button className="icon-btn small" aria-label="Dismiss" onClick={() => useUi.getState().dismissToast(t.id)}>
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function GlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = commandForEvent(e)
      if (!cmd) return
      if (useUi.getState().modal) {
        // Keep app shortcuts (Ctrl+P, Ctrl+O, …) from reaching the browser while a dialog is open.
        e.preventDefault()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      void cmd.run()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return null
}

