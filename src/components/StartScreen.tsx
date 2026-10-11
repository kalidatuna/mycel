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

  if (status === 'loading') {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <main className="start">
        <div className="start-card" aria-busy="true">
          <Logo size={44} />
          <h1>Reading your notes…</h1>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="muted">
            {progress.done} / {progress.total} notes
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="start">
      <div className="start-card">
        <Logo size={52} />
        <h1>Mycel</h1>
        <p className="tagline">Your notes, connected underneath.</p>
        <p className="muted start-sub">
          Open any folder of markdown notes. Mycel reads <code>[[wikilinks]]</code>, <code>#tags</code> and frontmatter, keeps
          everything on this computer, and never changes a file it doesn&apos;t need to.
        </p>
        <div className="start-actions">
          {saved && supported && (
            <button className="btn primary" onClick={reopen} disabled={busy}>
              <Icon name="folderOpen" /> Reopen “{saved.name}”
            </button>
          )}
          {supported ? (
            <button className={saved ? 'btn' : 'btn primary'} onClick={open} disabled={busy}>
              <Icon name="folder" /> Open a notes folder
            </button>
          ) : (
            <p className="notice">
              This browser can&apos;t open local folders. Use a desktop Chromium browser (Chrome, Edge, Arc, Brave) for your own
              notes — or try the demo below.
            </p>
          )}
          <button className="btn" onClick={() => run(openDemoVault)} disabled={busy} data-testid="demo-button">
            <Icon name="sparkle" /> Try the demo vault
          </button>
        </div>
        {saved && supported && (
          <button className="link-btn" onClick={forget}>
            Forget “{saved.name}”
          </button>
        )}
        {(msg || error) && (
          <p className="error" role="alert">
            {msg || error}
          </p>
        )}
        <ul className="start-points">
          <li>
            <Icon name="check" size={15} /> Works on your existing folder, as-is
          </li>
          <li>
            <Icon name="check" size={15} /> Local and private: no account, no server, no tracking
          </li>
          <li>
            <Icon name="check" size={15} /> Deleted notes go to <code>.trash</code>, never gone
          </li>
        </ul>
      </div>
    </main>
  )
}
