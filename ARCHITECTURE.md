# Mycel architecture

## Module layout

```
src/
  core/            Pure TypeScript. No DOM. Shared by the app, the tests and the CLI.
    parse.ts         Markdown note → ParsedNote (frontmatter, links, tags, headings, tasks)
    frontmatter.ts   Locate + parse YAML frontmatter; line-level value splicing
    paths.ts         Path helpers (basename, dirname, join, title from path)
    resolve.ts       Link target → note path (exact path, then unique basename, then shortest)
    rewrite.ts       Rewrite inbound links when a note is renamed or moved
    vaultIndex.ts    VaultIndex: notes, outgoing/backlinks, unresolved links, tags
    mentions.ts      Unlinked mentions of a note's title/aliases
    search.ts        MiniSearch wrapper + highlighted snippets
    templates.ts     {{date}}, {{time}}, {{title}} substitution, daily-note naming
  fs/
    types.ts         VaultFS interface + FileEntry
    fsAccess.ts      VaultFS over FileSystemDirectoryHandle
    memoryFs.ts      In-memory VaultFS (demo vault, tests)
    handleStore.ts   Persist the directory handle in IndexedDB
    watcher.ts       FileSystemObserver or polling diff → change events
  vault/
    actions.ts       All mutations: save, create, rename (+link rewrite), move, trash
    loader.ts        Open a VaultFS, read files, build the index, start the watcher
  store/             Zustand: vault (index + version), workspace (panes/tabs), ui (theme, modals)
  editor/            CodeMirror extensions: live preview, wikilinks, autocomplete, theme
  components/        React UI (sidebar, file tree, panels, editor pane, palettes, start screen)
  workers/           (phase 3) embedding + layout workers
  styles/            tokens.css (light/dark) + component CSS
```

## Data model

```ts
interface Note {
  path: string            // "Coffee/V60 Technique.md", vault-relative, forward slashes
  title: string           // basename without .md
  text: string            // exact file contents, never re-serialized
  mtime: number           // ms since epoch, from the file system
  created: number         // frontmatter `created`, else mtime
  hash: string            // FNV-1a of text; cache key for search + embeddings
  parsed: ParsedNote
}
interface ParsedNote {
  frontmatter: { raw: string; data: Record<string, unknown>; end: number; error?: string } | null
  links: Link[]; tags: Tag[]; headings: Heading[]; aliases: string[]
}
interface Link {           // [[target#heading|alias]] or ![[...]]
  raw: string; target: string; heading?: string; alias?: string; embed: boolean
  from: number; to: number           // offsets of the whole [[...]] in text
  targetFrom: number; targetTo: number // offsets of the target part, for rewriting
}
interface Tag { name: string; from: number; to: number; source: 'inline' | 'frontmatter' }
interface Embedding { path: string; hash: string; chunks: { from: number; to: number; vector: Float32Array }[] }
```

`VaultIndex` keeps: `notes: Map<path, Note>`, `outgoing: Map<path, ResolvedLink[]>`,
`backlinks: Map<path, Set<path>>`, `unresolved: Map<target, Set<path>>`, `tags: Map<tag, Set<path>>`,
and a lowercase basename → paths map for resolution. Updating one note re-resolves only that
note's links, except when a note is added/removed/renamed, which can change how other notes'
bare links resolve; those notes (found via the basename map and `unresolved`) are re-resolved.

## Indexing pipeline

1. `VaultFS.list()` → `FileEntry[]` (path, mtime, size). Dot-folders (`.git`, `.trash`, app
   config folders) and non-`.md` files are skipped.
2. Read files in parallel batches of 32 → `parseNote` → `VaultIndex.upsert`.
3. Build the MiniSearch index (title boosted ×3, tags ×2, body ×1).
4. Phase 3: hash each note; embed only notes whose hash isn't in the IndexedDB cache.
5. Change events from the watcher go through the same `upsert`/`remove` path.

## Worker boundaries

- Main thread: parsing, index, MiniSearch (all fast; 3,000 notes parse in well under 1 s).
- `embed.worker.ts` (phase 3): transformers.js model, chunk embedding, NLI. Messages are
  `{type:'embed', items:[{path, hash, chunks}]}` → progress + vectors. Vectors are transferred.
- Graph layout (phase 2): graphology ForceAtlas2 in its built-in worker supervisor.

## File watching

`watcher.ts` prefers `FileSystemObserver` (Chromium, where available). Otherwise it polls:
every 3 s and on window focus it lists the tree and compares `(path, mtime, size)` with the
last snapshot, emitting `added | changed | removed`. Mycel records the mtime of its own writes
so they are not reported back as external changes. An external change to an open note
replaces the editor content only when the editor has no unsaved edits; otherwise a conflict
banner offers "keep mine" or "load theirs".

## Write safety

- Every mutation goes through `vault/actions.ts`; a write whose content equals the current
  text is skipped.
- `createWritable()` writes to a swap file and atomically replaces on `close()`.
- Rename/move uses `FileSystemHandle.move()` when available, else copy → verify → remove.
- Delete moves to `.trash/<original path>`; never `removeEntry` on user content without a copy.
- Link rewriting touches only the `[[target]]` span; aliases, headings, surrounding text,
  frontmatter and unknown syntax are byte-for-byte preserved.
