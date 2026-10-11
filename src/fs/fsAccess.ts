import { freeTrashPath, type FileEntry, type VaultFS } from './types'

type Movable = FileSystemFileHandle & { move?: (dir: FileSystemDirectoryHandle, name: string) => Promise<void> }

interface ObserverRecord {
  type: string
}
type ObserverCtor = new (cb: (records: ObserverRecord[]) => void) => {
  observe(h: FileSystemHandle, o: { recursive: boolean }): Promise<void>
  disconnect(): void
}

const split = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  const name = parts.pop()
  if (!name) throw new Error(`Bad path: "${path}"`)
  return { dirs: parts, name }
}

/** VaultFS over a real folder via the File System Access API (Chromium). */
export class FsAccessFS implements VaultFS {
  readonly kind = 'folder' as const

  constructor(readonly root: FileSystemDirectoryHandle) {}

  get name() {
    return this.root.name
  }

  private async dir(parts: string[], create = false): Promise<FileSystemDirectoryHandle> {
    let d = this.root
    for (const p of parts) d = await d.getDirectoryHandle(p, { create })
    return d
  }

  private async fileHandle(path: string, create = false) {
    const { dirs, name } = split(path)
    return (await this.dir(dirs, create)).getFileHandle(name, { create })
  }

  async list(): Promise<FileEntry[]> {
    const out: FileEntry[] = []
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
      const jobs: Promise<void>[] = []
      for await (const [name, handle] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
        if (name.startsWith('.')) continue
        const path = prefix ? `${prefix}/${name}` : name
        if (handle.kind === 'directory') {
          out.push({ path, kind: 'dir', mtime: 0, size: 0 })
          jobs.push(walk(handle as FileSystemDirectoryHandle, path))
        } else {
          jobs.push(
            (handle as FileSystemFileHandle).getFile().then(
              (f) => void out.push({ path, kind: 'file', mtime: f.lastModified, size: f.size }),
              () => undefined, // file vanished or unreadable: skip it
            ),
          )
        }
      }
      await Promise.all(jobs)
    }
    await walk(this.root, '')
    return out
  }

  async read(path: string) {
    const f = await (await this.fileHandle(path)).getFile()
    return { text: await f.text(), mtime: f.lastModified }
  }

  /** createWritable() writes to a swap file and atomically replaces the original on close(). */
  async write(path: string, text: string) {
    const h = await this.fileHandle(path, true)
    const w = await h.createWritable()
    try {
      await w.write(text)
      await w.close()
    } catch (e) {
      await w.abort().catch(() => undefined)
      throw e
    }
    return (await h.getFile()).lastModified
  }

  async exists(path: string) {
    const { dirs, name } = split(path)
    try {
      const d = await this.dir(dirs)
      try {
        await d.getFileHandle(name)
        return true
      } catch {
        await d.getDirectoryHandle(name)
        return true
      }
    } catch {
      return false
    }
  }

  async mkdir(path: string) {
    await this.dir(path.split('/').filter(Boolean), true)
  }

  async rename(from: string, to: string) {
    if (await this.exists(to)) throw new Error(`"${to}" already exists`)
    const src = (await this.fileHandle(from)) as Movable
    const { dirs, name } = split(to)
    const destDir = await this.dir(dirs, true)
    if (typeof src.move === 'function') {
      try {
        await src.move(destDir, name)
        return
      } catch {
        // Fall through to copy + verify + remove.
      }
    }
    const data = await (await src.getFile()).arrayBuffer()
    const dest = await destDir.getFileHandle(name, { create: true })
    const w = await dest.createWritable()
    await w.write(data)
    await w.close()
    const check = await (await dest.getFile()).arrayBuffer()
    if (check.byteLength !== data.byteLength) throw new Error(`Copy of "${from}" could not be verified; original kept`)
    const s = split(from)
    await (await this.dir(s.dirs)).removeEntry(s.name)
  }

  async trash(path: string) {
    const dest = await freeTrashPath(this, path)
    await this.rename(path, dest)
    return dest
  }

  async removeEmptyDir(path: string) {
    const { dirs, name } = split(path)
    const parent = await this.dir(dirs)
    const d = await parent.getDirectoryHandle(name)
    for await (const _ of d as unknown as AsyncIterable<unknown>) return // not empty: keep it
    await parent.removeEntry(name)
  }

  observe(onChange: () => void) {
    const Ctor = (globalThis as unknown as { FileSystemObserver?: ObserverCtor }).FileSystemObserver
    if (!Ctor) return () => undefined
    const obs = new Ctor(() => onChange())
    obs.observe(this.root, { recursive: true }).catch(() => undefined)
    return () => obs.disconnect()
  }
}

export const hasFsAccess = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window

export async function pickFolder(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
  return picker({ id: 'mycel-vault', mode: 'readwrite' })
}

type PermHandle = FileSystemDirectoryHandle & {
  queryPermission(o: { mode: string }): Promise<PermissionState>
  requestPermission(o: { mode: string }): Promise<PermissionState>
}

export async function ensurePermission(handle: FileSystemDirectoryHandle, request: boolean): Promise<boolean> {
  const h = handle as PermHandle
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true
  if (!request) return false
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted'
}
