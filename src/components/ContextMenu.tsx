import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export type MenuItem = { separator: true } | { label: string; icon?: string; hint?: string; danger?: boolean; run: () => unknown }

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos({ x: Math.min(x, innerWidth - r.width - 8), y: Math.min(y, innerHeight - r.height - 8) })
    ;(ref.current?.querySelector('button') as HTMLElement | null)?.focus()
  }, [x, y])

  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('mousedown', down)
    addEventListener('keydown', key)
    addEventListener('blur', onClose)
    return () => {
      removeEventListener('mousedown', down)
      removeEventListener('keydown', key)
      removeEventListener('blur', onClose)
    }
  }, [onClose])

  const onKey = (e: React.KeyboardEvent) => {
    const btns = [...(ref.current?.querySelectorAll('button') ?? [])]
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') btns[(i + 1) % btns.length]?.focus()
    else if (e.key === 'ArrowUp') btns[(i - 1 + btns.length) % btns.length]?.focus()
    else return
    e.preventDefault()
  }

  return (
    <div ref={ref} className="menu" role="menu" style={{ left: pos.x, top: pos.y }} onKeyDown={onKey}>
      {items.map((it, i) =>
        'separator' in it ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={'menu-item' + (it.danger ? ' danger' : '')}
            onClick={() => {
              onClose()
              void it.run()
            }}
          >
            {it.icon && <Icon name={it.icon} size={15} />}
            <span>{it.label}</span>
            {it.hint && <kbd>{it.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  )
}
