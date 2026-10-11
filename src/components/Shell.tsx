import { useEffect } from 'react'
import { commandForEvent, runCommand } from '../commands/registry'
import { useSaveState } from '../editor/stateCache'
import { useUi, type LeftTab } from '../store/ui'
import { useVault } from '../store/vault'
import { FileTree } from './FileTree'
import { useActiveNote } from './hooks'
import { Icon, Logo } from './Icon'
import { Modals } from './Modals'
import { RightSidebar } from './RightSidebar'
import { SearchPanel } from './SearchPanel'
import { TagBrowser } from './TagBrowser'
import { Workspace } from './Workspace'
import { session } from '../vault/session'

function Ribbon() {
  const { leftTab, leftOpen, theme, rightOpen } = useUi()
  const tab = (t: LeftTab, icon: string, label: string) => (
    <button
      className="icon-btn"
      aria-pressed={leftOpen && leftTab === t}
      title={label}
      aria-label={label}
      onClick={() => (leftOpen && leftTab === t ? useUi.getState().toggleLeft() : useUi.getState().setLeftTab(t))}
    >
      <Icon name={icon} />
    </button>
  )
  return (
    <nav className="ribbon" aria-label="Main">
      <div className="ribbon-logo" title="Mycel">
        <Logo size={24} />
      </div>
      {tab('files', 'files', 'Files')}
      {tab('search', 'search', 'Search (Ctrl+Shift+F)')}
      {tab('tags', 'tag', 'Tags')}
      <div className="ribbon-sep" />
      <button className="icon-btn" title="Today's daily note (Alt+D)" aria-label="Open today's daily note" onClick={() => runCommand('daily')}>
        <Icon name="calendar" />
      </button>
      <button className="icon-btn" title="Command palette (Ctrl+P)" aria-label="Open command palette" onClick={() => runCommand('palette')}>
        <Icon name="command" />
      </button>
      <div className="ribbon-spacer" />
      <button className="icon-btn" aria-pressed={rightOpen} title="Toggle details panel" aria-label="Toggle details panel" onClick={() => useUi.getState().toggleRight()}>
        <Icon name="panel-right" />
      </button>
      <button className="icon-btn" title={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-label="Toggle theme" onClick={() => runCommand('theme')}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
    </nav>
  )
}

function StatusBar() {
  const { name, kind, version } = useVault()
  const note = useActiveNote()
  const save = useSaveState((s) => s.state)
  const words = note ? note.text.slice(note.parsed.frontmatter?.end ?? 0).split(/\s+/).filter(Boolean).length : 0
  const saveLabel = { saved: 'Saved', pending: 'Editing…', saving: 'Saving…', error: 'Save failed' }[save]
  return (
    <footer className="statusbar">
      <span className="status-vault">
        <Icon name={kind === 'memory' ? 'sparkle' : 'folder'} size={13} /> {name}
        {kind === 'memory' && <span className="pill">demo · changes stay in this tab</span>}
      </span>
      <span className="status-spacer" />
      {note && <span>{words.toLocaleString()} words</span>}
      <span data-version={version}>{session.index.size.toLocaleString()} notes</span>
      <span className={'save-' + save} aria-live="polite">
        {saveLabel}
      </span>
    </footer>
  )
}

function Toasts() {
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
      if (useUi.getState().modal) return
      const cmd = commandForEvent(e)
      if (!cmd) return
      e.preventDefault()
      e.stopPropagation()
      void cmd.run()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return null
}

export function Shell() {
  const { leftOpen, leftTab, rightOpen } = useUi()
  return (
    <div className={'shell' + (leftOpen ? '' : ' no-left') + (rightOpen ? '' : ' no-right')}>
      <a className="skip-link" href="#main-editor" onClick={(e) => (e.preventDefault(), runCommand('focus-editor'))}>
        Skip to editor
      </a>
      <Ribbon />
      {leftOpen && (
        <aside className="left-sidebar" aria-label={leftTab === 'files' ? 'Files' : leftTab === 'search' ? 'Search' : 'Tags'}>
          {leftTab === 'files' ? <FileTree /> : leftTab === 'search' ? <SearchPanel /> : <TagBrowser />}
        </aside>
      )}
      <main id="main-editor" className="main">
        <Workspace />
      </main>
      {rightOpen && <RightSidebar />}
      <StatusBar />
      <Toasts />
      <Modals />
    </div>
  )
}

export { Toasts }
