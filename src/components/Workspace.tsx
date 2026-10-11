import { runCommand } from '../commands/registry'
import { stripMd, basename } from '../core/paths'
import { useWorkspace, type Pane } from '../store/workspace'
import { Icon } from './Icon'
import { NoteEditor } from './NoteEditor'

function TabBar({ pane, idx, canClosePane }: { pane: Pane; idx: number; canClosePane: boolean }) {
  const { open, close, split, closePane } = useWorkspace.getState()
  return (
    <div className="tabbar">
      <div className="tabs" role="tablist" aria-label={`Pane ${idx + 1} tabs`}>
        {pane.tabs.map((t) => (
          <div key={t} className={'tab' + (t === pane.active ? ' active' : '')} title={t}>
            <button
              role="tab"
              aria-selected={t === pane.active}
              className="tab-label"
              onClick={() => open(t, { pane: idx })}
              onAuxClick={(e) => e.button === 1 && close(idx, t)}
            >
              {stripMd(basename(t))}
            </button>
            <button className="tab-close" aria-label={`Close ${stripMd(basename(t))}`} onClick={() => close(idx, t)}>
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="tabbar-actions">
        {idx === 0 && !canClosePane && (
          <button className="icon-btn small" title="Split editor (Ctrl+\)" aria-label="Split editor" onClick={() => split()}>
            <Icon name="columns" size={16} />
          </button>
        )}
        {canClosePane && (
          <button className="icon-btn small" title="Close pane" aria-label="Close pane" onClick={() => closePane(idx)}>
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

function EmptyPane() {
  return (
    <div className="empty-pane">
      <p className="muted">No note open</p>
      <div className="empty-actions">
        <button className="btn" onClick={() => runCommand('switcher')}>
          <Icon name="search" size={16} /> Open a note <kbd>Ctrl+O</kbd>
        </button>
        <button className="btn" onClick={() => runCommand('new-note')}>
          <Icon name="file-plus" size={16} /> New note <kbd>Alt+N</kbd>
        </button>
        <button className="btn" onClick={() => runCommand('daily')}>
          <Icon name="calendar" size={16} /> Today&apos;s note <kbd>Alt+D</kbd>
        </button>
      </div>
    </div>
  )
}

export function Workspace() {
  const panes = useWorkspace((s) => s.panes)
  const activePane = useWorkspace((s) => s.activePane)
  const focusPane = useWorkspace((s) => s.focusPane)
  return (
    <div className="workspace">
      {panes.map((p, i) => (
        <section
          key={p.id}
          className={'pane' + (i === activePane && panes.length > 1 ? ' focused' : '')}
          aria-label={`Editor pane ${i + 1}`}
          onFocusCapture={() => i !== useWorkspace.getState().activePane && focusPane(i)}
          onMouseDownCapture={() => i !== useWorkspace.getState().activePane && focusPane(i)}
        >
          <TabBar pane={p} idx={i} canClosePane={panes.length > 1} />
          <NoteEditor pane={p} paneIdx={i} />
          {!p.active && <EmptyPane />}
        </section>
      ))}
    </div>
  )
}
