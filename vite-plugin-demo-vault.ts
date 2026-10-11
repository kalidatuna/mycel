import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

/** Exposes the demo vault as `virtual:demo-vault`: [{ path, text, mtime }]. */
export function demoVault(root: string, datesFile: string): Plugin {
  const id = 'virtual:demo-vault'
  const resolved = '\0' + id
  const walk = (dir: string, out: string[]) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p, out)
      else if (name.endsWith('.md')) out.push(p)
    }
    return out
  }
  return {
    name: 'mycel-demo-vault',
    resolveId: (s) => (s === id ? resolved : undefined),
    load(s) {
      if (s !== resolved) return
      const dates: Record<string, string> = existsSync(datesFile) ? JSON.parse(readFileSync(datesFile, 'utf8')) : {}
      const files = walk(root, []).map((abs) => {
        const path = relative(root, abs).split(sep).join('/')
        this.addWatchFile(abs)
        const d = dates[path]
        return { path, text: readFileSync(abs, 'utf8'), mtime: d ? Date.parse(d) : statSync(abs).mtimeMs }
      })
      return `export default ${JSON.stringify(files)}`
    },
  }
}
