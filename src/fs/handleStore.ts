import { openDB } from 'idb'

const db = () => openDB('mycel', 1, { upgrade: (d) => void d.createObjectStore('handles') })

export async function saveHandle(handle: FileSystemDirectoryHandle) {
  await (await db()).put('handles', handle, 'vault')
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return ((await (await db()).get('handles', 'vault')) as FileSystemDirectoryHandle | undefined) ?? null
  } catch {
    return null
  }
}

export async function forgetHandle() {
  await (await db()).delete('handles', 'vault')
}
