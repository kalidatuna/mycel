# Mycel — working notes for Claude

Mycel is a local-first markdown knowledge base with on-device AI. It opens any folder of
`.md` files that uses `[[wikilinks]]`, `#tags` and YAML frontmatter. Name and identity are
original: the app is never described as a clone of, or compatible "with", any named product.

## Commands

```bash
npm install          # also runs scripts/touch-demo-vault.mjs (restores demo mtimes)
npm run dev          # Vite dev server on http://localhost:5173
npm test             # Vitest unit tests (src/**/*.test.ts)
npm run e2e          # Playwright end-to-end tests (starts its own dev server on 5174)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build to dist/
```

## Stack

TypeScript strict, Vite, React 19, Zustand, CodeMirror 6, MiniSearch, idb, `yaml` (parse only),
graphology + Sigma (phase 2), transformers.js in a worker (phase 3), Vitest, Playwright.

## Conventions

- `src/core/` is pure TypeScript: no DOM, no React, no browser APIs. The CLI (phase 5) and
  the unit tests import it directly. Anything that touches `window` lives elsewhere.
- `src/fs/` hides storage behind the `VaultFS` interface. Two implementations: File System
  Access (real folders) and in-memory (demo vault, tests).
- State lives in Zustand stores in `src/store/`. The `VaultIndex` is a mutable class; stores
  expose a `version` counter that components subscribe to instead of copying the index.
- Components stay under ~300 lines. One component per file. CSS in `src/styles/*.css`
  using CSS custom properties defined in `tokens.css` (light + dark).
- Never re-serialize markdown or YAML. All edits are text splices on the original string.
- Every write goes through `vault/actions.ts`, which skips the write when content is unchanged.
- Commit after each working step; keep `main` green (`npm test && npm run typecheck`).

## Gotchas

- File System Access API gives no creation time. "Created" comes from frontmatter
  `created:` when present, else falls back to `lastModified`.
- git does not keep mtimes. `scripts/demo-dates.json` holds the demo vault's dates, applied
  by `postinstall` (for real-folder use) and read by the Vite `virtual:demo-vault` plugin.
- Persisted directory handles need `requestPermission` from a user gesture after reload, so
  the start screen shows a "Reopen <vault>" button instead of opening silently.
- `showDirectoryPicker` cannot be driven by Playwright; e2e tests use the demo vault
  (`/?demo=1`), which runs the same code paths through the in-memory `VaultFS`.
- Links and tags inside fenced code, inline code and HTML comments are ignored by the parser.

## Decisions log

- 2026-10-11 Name: **Mycel** (mycelium: notes connected underneath, growing over time).
- 2026-10-11 Trash is `.trash/` at the vault root; files keep their relative path inside it
  and get a numeric suffix on collision. Nothing is ever hard-deleted.
- 2026-10-11 New notes created from a missing link go to the vault root (simple, predictable).
- 2026-10-11 Link rewriting on rename keeps the link's style: a bare-name link stays bare if
  the new name is still unique, otherwise it becomes a path link. Alias and `#heading` kept.
- 2026-10-11 File watching: `FileSystemObserver` when the browser has it, else polling
  every 3 s plus on window focus. Our own writes are recorded so they don't echo back.
- 2026-10-11 Writes use `createWritable()`, which Chromium writes to a swap file and
  commits on `close()` — atomic from the reader's point of view.
- 2026-10-11 Frontmatter panel edits scalar values by replacing just that line; lists and
  nested values are shown read-only with a jump-to-source action.
- 2026-10-11 Tabs keep their own CodeMirror `EditorState`, so undo history survives tab
  switches. Max two split panes (left/right) — enough for the demo, simple to reason about.
