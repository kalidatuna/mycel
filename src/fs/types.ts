export interface FileEntry {
  path: string
  kind: 'file' | 'dir'
  mtime: number
  size: number
}

/** Storage behind a vault. All paths are vault-relative with forward slashes. */
export interface VaultFS {
  readonly name: string
  readonly kind: 'folder' | 'memory'
  /** Every non-hidden file and folder, recursively. */
  list(): Promise<FileEntry[]>
  read(path: string): Promise<{ text: string; mtime: number }>
  /** Create or overwrite a text file (creating parent folders). Returns the new mtime. */
  write(path: string, text: string): Promise<number>
  exists(path: string): Promise<boolean>
  mkdir(path: string): Promise<void>
  /** Move a file. Fails if `to` already exists. */
  rename(from: string, to: string): Promise<void>
  /** Move a file into `.trash/`, keeping its relative path. Returns the trash path. */
  trash(path: string): Promise<string>
  /** Remove a folder only if it is empty (after its files were moved/trashed). */
  removeEmptyDir(path: string): Promise<void>
  /** Optional native change notifications; the watcher polls when absent. */
  observe?(onChange: () => void): () => void
}

export const TRASH = '.trash'

/** "a/b.md" → ".trash/a/b.md", then ".trash/a/b 1.md", ... */
export async function freeTrashPath(fs: Pick<VaultFS, 'exists'>, path: string): Promise<string> {
  const dot = path.lastIndexOf('.')
  const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path
  const ext = dot > path.lastIndexOf('/') ? path.slice(dot) : ''
  for (let i = 0; ; i++) {
    const candidate = `${TRASH}/${stem}${i ? ' ' + i : ''}${ext}`
    if (!(await fs.exists(candidate))) return candidate
  }
}
