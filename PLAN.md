# Mycel — plan

**Mycel**: your notes, connected underneath. A local-first markdown knowledge base that
finds the links you missed, replays how your thinking grew, and tells you where your notes
disagree with each other — all on your machine.

## Phase 0: Setup
- [x] CLAUDE.md, PLAN.md, ARCHITECTURE.md
- [x] Scaffold Vite + React + TS strict, Vitest, Playwright, ESLint
- [x] Demo vault: 65 notes, Jan–Oct 2026 dates, orphans, near-duplicates, corrected claims, 3 contradiction pairs
- [x] Demo vault dates applied on install, bundled for "Try the demo vault"

## Phase 1: Core app
- [x] Open folder (File System Access), remember across sessions, watch for changes
- [x] File tree: create, rename (rewrites inbound links), move (menu + drag and drop), delete to `.trash/`
- [x] Editor: markdown highlighting, live preview (headings, bold/italic, links, checkboxes, bullets, quotes, code), autosave, undo
- [x] Tabs and split panes (undo history kept per tab)
- [x] Wikilinks: `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, autocomplete (notes, aliases, headings, tags), click to follow, create-on-click
- [x] Backlinks panel with context
- [x] Unlinked mentions panel with "Link it"
- [x] Tags (#inline + frontmatter, nested) and tag browser
- [x] Frontmatter properties panel (scalar values editable in place)
- [x] Quick switcher (Ctrl+O), command palette (Ctrl+P), full-text search with highlighted snippets and `tag:` filter
- [x] Daily note (Alt+D) and templates (Alt+T)
- [x] Light/dark themes, keyboard navigation (tree, palettes, menus), skip link
- [x] Unit tests: parser, frontmatter, resolution, link rewriting, index, mentions, search, vault actions (44)
- [x] E2E: demo vault flows (13) + real File System Access path via OPFS (edit, rename, trash, watcher)

## Phase 2: Graph
- [ ] Global graph (Sigma + graphology): zoom, pan, drag, click to open, hover highlights neighbours
- [ ] Filters: tag, folder, date range, orphans
- [ ] Local graph for current note with depth control
- [ ] Node size by degree, orphans flagged
- [ ] Worker layout; smooth at 3,000+ notes

## Phase 3: Differentiators
- [ ] Embedding worker (transformers.js, WebGPU → WASM), chunking, IndexedDB cache by hash, incremental, progress
- [ ] Suggested links panel with scores and one-click insert
- [ ] Semantic search mode
- [ ] Semantic clusters: colour graph, auto-name from top terms
- [ ] Time-travel slider: replay growth, play/pause, speed, stats strip (notes, links, density)
- [ ] Linter: orphans, broken links, duplicates/near-duplicates, untagged, stale
- [ ] Contradiction detector: embedding candidates → NLI (or heuristic fallback), side-by-side view, dismiss/resolve
- [ ] One-click fix or jump for every finding; honest confidence labels

## Phase 4: Extensibility
- [ ] Plugin API (commands, sidebar panels, editor extensions), sandboxed by error boundaries
- [ ] Two example plugins
- [ ] Export vault report (markdown), graph PNG/SVG

## Phase 5: Stretch
- [ ] Yjs + y-webrtc multiplayer with presence and invite code
- [ ] CLI linter (`npx mycel-lint <folder>` → JSON)

## Phase 6: Polish and proof
- [ ] 3,000-note synthetic benchmark; numbers in README
- [ ] Loading/empty/error states, onboarding, a11y basics
- [ ] All tests green
- [ ] README, DEMO.md
- [ ] Dead code and lint cleanup; fresh clone runs with 2 commands
