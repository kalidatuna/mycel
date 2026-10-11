import { useEffect, useState } from 'react'
import { ensurePermission, hasFsAccess, pickFolder } from '../fs/fsAccess'
import { forgetHandle, loadHandle } from '../fs/handleStore'
import { useVault } from '../store/vault'
import { openDemoVault, openFolder } from '../vault/loader'
import { Icon, Logo } from './Icon'

export function StartScreen() {
  const { status, progress, error } = useVault()
  const [saved, setSaved] = useState<FileSystemDirectoryHandle | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const supported = hasFsAccess()

  useEffect(() => {
    if (supported) void loadHandle().then(setSaved)
  }, [supported])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      const err = e as Error
      if (err.name !== 'AbortError') setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  const open = () => run(async () => openFolder(await pickFolder()))
  const reopen = () =>
    run(async () => {
      if (!saved) return
      if (!(await ensurePermission(saved, true))) throw new Error('Permission to the folder was not granted.')
      await openFolder(saved)
    })
  const forget = async () => {
    await forgetHandle()
    setSaved(null)
  }

  const brand = (
    <div className="start-brand">
      <Logo size={22} />
      <h1>Mycel</h1>
    </div>
  )

  if (status === 'loading') {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <main className="start">
        <div className="start-card" aria-busy="true">
          {brand}
          <div className="progress" role="progressbar" aria-label="Reading notes" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="muted">
            Reading notes… {progress.done} of {progress.total}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="start">
      <div className="start-card">
        {brand}
        <p className="start-sub">
          A markdown notes app that works on a folder you already have. It reads <code>[[links]]</code>, <code>#tags</code> and
          frontmatter, and only writes to a file when you change it.
        </p>
        <div className="start-actions">
          {!supported && (
            <p className="notice">This browser can&apos;t open local folders. Use Chrome, Edge or another Chromium browser on desktop, or try the demo.</p>
          )}
          {saved && supported && (
            <button className="start-action" onClick={reopen} disabled={busy}>
              <Icon name="folderOpen" />
              <strong>Reopen {saved.name}</strong>
              <small>Last folder you used</small>
            </button>
          )}
          {supported && (
            <button className="start-action" onClick={open} disabled={busy}>
              <Icon name="folder" />
              <strong>Open folder…</strong>
              <small>Any folder of .md files</small>
            </button>
          )}
          <button className="start-action" onClick={() => run(openDemoVault)} disabled={busy} data-testid="demo-button">
            <Icon name="book" />
            <strong>Try the demo vault</strong>
            <small>65 sample notes, kept in memory</small>
          </button>
        </div>
        {(msg || error) && (
          <p className="error" role="alert">
            {msg || error}
          </p>
        )}
        <p className="start-foot">
          <span>Runs locally. No account, no server, no tracking.</span>
          {saved && supported && (
            <button className="link-btn" onClick={forget}>
              Forget {saved.name}
            </button>
          )}
        </p>
      </div>
    </main>
  )
}
