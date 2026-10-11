/** Vault-relative path helpers. Paths always use forward slashes and no leading slash. */

export const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1)

export const dirname = (path: string) => {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

export const join = (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/')

export const stripMd = (name: string) => (name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name)

/** "Coffee/V60 Technique.md" → "V60 Technique" */
export const titleOf = (path: string) => stripMd(basename(path))

export const isMarkdown = (path: string) => path.toLowerCase().endsWith('.md')

export const extname = (path: string) => {
  const b = basename(path)
  const i = b.lastIndexOf('.')
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase()
}

/** True for paths inside dot-folders or dot-files (".git", ".trash", app config, ...). */
export const isHidden = (path: string) => path.split('/').some((p) => p.startsWith('.'))

/** Characters that are not allowed in note names on common file systems or in wikilinks. */
export const INVALID_NAME = /[\\/:*?"<>|#^[\]]/

export const sanitizeName = (name: string) => name.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim()
