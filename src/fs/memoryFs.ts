import { freeTrashPath, type FileEntry, type VaultFS } from './types'

interface MemFile {
  text: string
  mtime: number
}

/** In-memory vault. Used for the demo vault and in tests. */
export class MemoryFS implements VaultFS {
  readonly kind = 'memory' as const
  private files = new Map<string, MemFile>()
  private dirs = new Set<string>()
  private clock = 0
  private listeners = new Set<() => void>()

  constructor(readonly name: string, seed: { path: string; text: string; mtime: number }[] = []) {
    for (const f of seed) {
      this.files.set(f.path, { text: f.text, mtime: f.mtime })
      this.addParents(f.path)
    }
  }

  private now() {
    this.clock = Math.max(Date.now(), this.clock + 1)
    return this.clock
  }

  private addParents(path: string) {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'))
  }

  private emit() {
    for (const l of this.listeners) l()
  }

  async list(): Promise<FileEntry[]> {
    const hidden = (p: string) => p.split('/').some((s) => s.startsWith('.'))
    const out: FileEntry[] = []
    for (const d of this.dirs) if (!hidden(d)) out.push({ path: d, kind: 'dir', mtime: 0, size: 0 })
    for (const [path, f] of this.files) if (!hidden(path)) out.push({ path, kind: 'file', mtime: f.mtime, size: f.text.length })
    return out
  }

  async read(path: string) {
    const f = this.files.get(path)
    if (!f) throw new Error(`Not found: ${path}`)
    return { text: f.text, mtime: f.mtime }
  }

  async write(path: string, text: string) {
    const mtime = this.now()
    this.files.set(path, { text, mtime })
    this.addParents(path)
    return mtime
  }

  async exists(path: string) {
    return this.files.has(path) || this.dirs.has(path)
  }

  async mkdir(path: string) {
    this.dirs.add(path)
    this.addParents(path)
  }

  async rename(from: string, to: string) {
    const f = this.files.get(from)
    if (!f) throw new Error(`Not found: ${from}`)
    if (await this.exists(to)) throw new Error(`Already exists: ${to}`)
    this.files.set(to, f)
    this.files.delete(from)
    this.addParents(to)
  }

  async trash(path: string) {
    const dest = await freeTrashPath(this, path)
    await this.rename(path, dest)
    return dest
  }

  async removeEmptyDir(path: string) {
    const prefix = path + '/'
    for (const p of this.files.keys()) if (p.startsWith(prefix)) return
    for (const d of this.dirs) if (d.startsWith(prefix)) return
    this.dirs.delete(path)
  }

  /** Simulate an edit made by another program (used by tests). */
  externalWrite(path: string, text: string) {
    this.files.set(path, { text, mtime: this.now() })
    this.addParents(path)
    this.emit()
  }

  observe(onChange: () => void) {
    this.listeners.add(onChange)
    return () => this.listeners.delete(onChange)
  }
}
