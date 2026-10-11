import { useEffect, useRef, useState } from 'react'
import { formatHotkey, listCommands } from '../commands/registry'
import { basename, dirname } from '../core/paths'
import { dialogs, toast, useUi } from '../store/ui'
import { useWorkspace } from '../store/workspace'
import { createNote, validateName } from '../vault/actions'
import { session } from '../vault/session'
import { QuickPick } from './QuickPick'

function Switcher({ onClose }: { onClose: () => void }) {
  const open = useWorkspace((s) => s.open)
  const items = [...session.index.notes.values()]
    .sort((a, b) => b.mtime - a.mtime)
    .flatMap((n) => [
      { id: n.path, label: n.title, detail: dirname(n.path) },
      ...n.parsed.aliases.map((a) => ({ id: `${n.path}\u0000${a}`, label: a, detail: `alias of ${n.title}` })),
    ])
  return (
    <QuickPick
      title="Quick switcher"
      placeholder="Find or create a note…"
      items={items}
      onClose={onClose}
      onPick={(it, { mod }) => {
        onClose()
        open(it.id.split('\u0000')[0]!, { newTab: mod })
      }}
      createLabel={(q) => (session.index.pathsWithTitle(q).length || validateName(basename(q)) ? null : `Create “${q}”`)}
      onCreate={(q) => {
        onClose()
        createNote(q.endsWith('.md') ? q : `${q}.md`, `# ${basename(q)}\n\n`).catch((e: Error) => toast(e.message, 'error'))
      }}
      footer={
        <>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Ctrl+Enter</kbd> new tab</span>
        </>
      }
    />
  )
}

function Palette({ onClose }: { onClose: () => void }) {
  const cmds = listCommands().filter((c) => c.id !== 'palette')
  return (
    <QuickPick
      title="Command palette"
      placeholder="Type a command…"
      items={cmds.map((c) => ({ id: c.id, label: c.name, hint: c.hotkey ? formatHotkey(c.hotkey) : undefined, detail: c.source && c.source !== 'core' ? c.source : undefined }))}
      onClose={onClose}
      onPick={(it) => {
        onClose()
        const c = cmds.find((x) => x.id === it.id)
        Promise.resolve()
          .then(() => c?.run())
          .catch((e: Error) => toast(e.message, 'error'))
      }}
    />
  )
}

function Prompt({ title, initial, okLabel, select, resolve, onClose }: { title: string; initial: string; okLabel: string; select?: [number, number]; resolve: (v: string | null) => void; onClose: () => void }) {
  const [v, setV] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    if (select) ref.current?.setSelectionRange(select[0], select[1])
    else ref.current?.select()
  }, [select])
  const done = (val: string | null) => {
    onClose()
    resolve(val)
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && done(null)}>
      <form
        className="modal dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        onSubmit={(e) => {
          e.preventDefault()
          done(v.trim())
        }}
        onKeyDown={(e) => e.key === 'Escape' && done(null)}
      >
        <h2 id="prompt-title">{title}</h2>
        <input ref={ref} className="input" value={v} onChange={(e) => setV(e.target.value)} aria-label={title} />
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => done(null)}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {okLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

function Confirm({ title, body, okLabel, danger, resolve, onClose }: { title: string; body: string; okLabel: string; danger?: boolean; resolve: (v: boolean) => void; onClose: () => void }) {
  const done = (v: boolean) => {
    onClose()
    resolve(v)
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && done(false)}>
      <div className="modal dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={(e) => e.key === 'Escape' && done(false)}>
        <h2 id="confirm-title">{title}</h2>
        <p className="muted">{body}</p>
        <div className="dialog-actions">
          <button className="btn" onClick={() => done(false)}>
            Cancel
          </button>
          <button autoFocus className={'btn ' + (danger ? 'danger' : 'primary')} onClick={() => done(true)}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Modals() {
  const modal = useUi((s) => s.modal)
  const close = () => useUi.getState().openModal(null)
  const restore = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (modal) restore.current = (document.activeElement as HTMLElement) ?? null
    else if (restore.current) {
      restore.current.focus?.()
      restore.current = null
    }
  }, [modal])
  if (!modal) return null
  switch (modal.kind) {
    case 'switcher':
      return <Switcher onClose={close} />
    case 'palette':
      return <Palette onClose={close} />
    case 'pick':
      return (
        <QuickPick
          title={modal.title}
          placeholder={modal.title}
          items={modal.items}
          onClose={() => {
            close()
            modal.resolve(null)
          }}
          onPick={(it) => {
            close()
            modal.resolve(it)
          }}
        />
      )
    case 'prompt':
      return <Prompt {...modal} onClose={close} />
    case 'confirm':
      return <Confirm {...modal} onClose={close} />
  }
}

export { dialogs }
