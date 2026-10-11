import type { FileEntry, VaultFS } from './types'

export interface FsChange {
  type: 'added' | 'changed' | 'removed'
  entry: FileEntry
}

const sig = (e: FileEntry) => `${e.kind}:${e.mtime}:${e.size}`

/**
 * Detects changes made outside the app. Uses native notifications when the VaultFS offers
 * them, and always polls as a fallback (paused while the tab is hidden).
 */
export class VaultWatcher {
  private snapshot = new Map<string, FileEntry>()
  private timer: ReturnType<typeof setInterval> | null = null
  private unobserve: (() => void) | null = null
  private busy = false
  private again = false

  constructor(
    private fs: VaultFS,
    private onChanges: (changes: FsChange[]) => void | Promise<void>,
    private intervalMs = 3000,
  ) {}

  start(initial: FileEntry[]) {
    this.snapshot = new Map(initial.map((e) => [e.path, e]))
    this.timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.poll()
    }, this.intervalMs)
    this.unobserve = this.fs.observe?.(() => void this.poll()) ?? null
    if (typeof window !== 'undefined') window.addEventListener('focus', this.onFocus)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.unobserve?.()
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.onFocus)
  }

  private onFocus = () => void this.poll()

  /** Record a change the app made itself so it is not reported back. */
  record(path: string, entry: FileEntry | null) {
    if (entry) this.snapshot.set(path, entry)
    else this.snapshot.delete(path)
  }

  async poll(): Promise<FsChange[]> {
    if (this.busy) {
      this.again = true
      return []
    }
    this.busy = true
    try {
      const entries = await this.fs.list()
      const next = new Map(entries.map((e) => [e.path, e]))
      const changes: FsChange[] = []
      for (const [p, e] of next) {
        const old = this.snapshot.get(p)
        if (!old) changes.push({ type: 'added', entry: e })
        else if (sig(old) !== sig(e)) changes.push({ type: 'changed', entry: e })
      }
      for (const [p, e] of this.snapshot) if (!next.has(p)) changes.push({ type: 'removed', entry: e })
      this.snapshot = next
      if (changes.length) await this.onChanges(changes)
      return changes
    } catch {
      return [] // folder temporarily unavailable; try again next tick
    } finally {
      this.busy = false
      if (this.again) {
        this.again = false
        void this.poll()
      }
    }
  }
}
