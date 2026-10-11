// Test helper: loads the demo vault from disk into a VaultIndex. Not imported by the app.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { VaultIndex, type NoteInput } from './vaultIndex'

const ROOT = new URL('../../demo-vault/', import.meta.url).pathname

export function readDemoVault(): NoteInput[] {
  const out: NoteInput[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue
      const abs = join(dir, name)
      const st = statSync(abs)
      if (st.isDirectory()) walk(abs)
      else if (name.endsWith('.md')) out.push({ path: relative(ROOT, abs).split(sep).join('/'), text: readFileSync(abs, 'utf8'), mtime: st.mtimeMs })
    }
  }
  walk(ROOT)
  return out
}

export function demoIndex(): VaultIndex {
  const idx = new VaultIndex()
  idx.load(readDemoVault())
  return idx
}

export function indexOf(files: Record<string, string>): VaultIndex {
  const idx = new VaultIndex()
  idx.load(Object.entries(files).map(([path, text]) => ({ path, text, mtime: 0 })))
  return idx
}
