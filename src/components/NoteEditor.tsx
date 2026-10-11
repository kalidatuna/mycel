import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorContext } from '../editor/context'
import { refreshEffect } from '../editor/context'
import { parsedDoc } from '../editor/docModel'
import { setPending } from '../editor/pending'
import { createState, fromDisk } from '../editor/setup'
import { docCache, useSaveState, type DocEntry } from '../editor/stateCache'
import { registerView } from '../editor/views'
import { useUi, toast } from '../store/ui'
import { useWorkspace, type Pane } from '../store/workspace'
import { followLink, saveNote } from '../vault/actions'
import { session } from '../vault/session'
import { useVaultVersion } from './hooks'

const SAVE_DELAY = 400

/** Replace the document with `text` using one minimal change, so the cursor mostly stays put. */
function syncDoc(view: EditorView, text: string) {
  const cur = view.state.doc.toString()
  if (cur === text) return
  let start = 0
  while (start < cur.length && start < text.length && cur[start] === text[start]) start++
  let endA = cur.length
  let endB = text.length
  while (endA > start && endB > start && cur[endA - 1] === text[endB - 1]) {
    endA--
    endB--
  }
  view.dispatch({ changes: { from: start, to: endA, insert: text.slice(start, endB) }, annotations: fromDisk.of(true) })
}

export function NoteEditor({ pane, paneIdx }: { pane: Pane; paneIdx: number }) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const entryRef = useRef<DocEntry | null>(null)
  const pathRef = useRef<string | null>(pane.active)
  const timers = useRef(new Map<DocEntry, ReturnType<typeof setTimeout>>())
  /** Registry key each entry's pending save was filed under (paths can change on rename). */
  const pendingKeys = useRef(new Map<DocEntry, string>())
  const [conflict, setConflict] = useState(false)
  const version = useVaultVersion()
  const anchor = useWorkspace((s) => s.anchor)
  pathRef.current = pane.active

  const ctx = useMemo<EditorContext>(
    () => ({
      path: () => pathRef.current ?? '',
      resolves: (t) => !!session.index.resolve(t, pathRef.current ?? ''),
      followLink: (target, heading, newTab) => void followLink(target, pathRef.current ?? '', heading, newTab).catch((e: Error) => toast(e.message, 'error')),
      openUrl: (url) => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(url)) window.open(url, '_blank', 'noopener,noreferrer')
        else void followLink(decodeURI(url), pathRef.current ?? '', undefined, false)
      },
      searchTag: (tag) => {
        useUi.getState().setSearchQuery(`tag:${tag}`)
        useUi.getState().setLeftTab('search')
      },
      noteTitles: () =>
        [...session.index.notes.values()].map((n) => ({
          title: n.title,
          path: n.path,
          aliases: n.parsed.aliases,
          unique: session.index.pathsWithTitle(n.title).length === 1,
        })),
      headingsOf: (target) => {
        const p = session.index.resolve(target, pathRef.current ?? '') ?? target
        return session.index.get(p)?.parsed.headings.map((h) => h.text) ?? []
      },
      allTags: () => [...session.index.tags().values()].map((t) => t.label).sort(),
    }),
    [],
  )

  // Saving: debounce per document, register with the flush registry so vault ops can wait for it.
  const flush = (entry: DocEntry) => async () => {
    const t = timers.current.get(entry)
    if (t) clearTimeout(t)
    timers.current.delete(entry)
    const text = entry === entryRef.current && viewRef.current ? viewRef.current.state.doc.toString() : entry.state.doc.toString()
    useSaveState.getState().set('saving')
    // Optimistic: the index will report this text back, which must not look like an external edit.
    const before = entry.synced
    entry.synced = text
    try {
      await saveNote(entry.holder.path, text)
      setPending(pendingKeys.current.get(entry) ?? pane.id + entry.holder.path, null)
      pendingKeys.current.delete(entry)
      useSaveState.getState().set('saved')
    } catch (e) {
      entry.synced = before
      useSaveState.getState().set('error')
      toast(`Could not save "${entry.holder.path}": ${(e as Error).message}`, 'error')
    }
  }

  const onDocChange = (entry: DocEntry) => () => {
    const t = timers.current.get(entry)
    if (t) clearTimeout(t)
    const f = flush(entry)
    timers.current.set(entry, setTimeout(f, SAVE_DELAY))
    const key = pendingKeys.current.get(entry) ?? `${pane.id}:${entry.holder.path}`
    pendingKeys.current.set(entry, key)
    setPending(key, f)
    useSaveState.getState().set('pending')
  }

  const entryFor = (path: string): DocEntry | null => {
    const cached = docCache.get(pane.id, path)
    if (cached) return cached
    const note = session.index.get(path)
    if (!note) return null
    const holder = { path }
    const entry = { holder, synced: note.text } as DocEntry
    entry.state = createState(note.text, ctx, onDocChange(entry))
    docCache.set(pane.id, path, entry)
    return entry
  }

  // Create the view once per pane.
  useEffect(() => {
    const view = new EditorView({ parent: host.current! })
    viewRef.current = view
    registerView(pane.id, view)
    return () => {
      if (entryRef.current) entryRef.current.state = view.state
      entryRef.current = null
      registerView(pane.id, null)
      view.destroy()
      viewRef.current = null
    }
  }, [pane.id])

  // Switch documents when the active tab changes.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const prev = entryRef.current
    if (prev) {
      prev.state = view.state
      void setPendingFlush(prev)
    }
    const next = pane.active ? entryFor(pane.active) : null
    entryRef.current = next
    setConflict(false)
    if (next) {
      view.setState(next.state)
      reconcile()
    }
    docCache.prune(pane.id, pane.tabs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.active])

  const setPendingFlush = (entry: DocEntry) => (timers.current.has(entry) ? flush(entry)() : undefined)

  useEffect(() => {
    docCache.prune(pane.id, pane.tabs)
  }, [pane.id, pane.tabs])

  /** Bring the open document in line with the index (external edits, link rewrites). */
  const reconcile = () => {
    const view = viewRef.current
    const entry = entryRef.current
    if (!view || !entry) return
    const note = session.index.get(entry.holder.path)
    if (!note || note.text === entry.synced) return view.dispatch({ effects: refreshEffect.of(null) })
    if (view.state.doc.toString() === entry.synced || view.state.doc.toString() === note.text) {
      syncDoc(view, note.text)
      entry.synced = note.text
      setConflict(false)
    } else setConflict(true)
  }

  useEffect(reconcile, [version])

  // Scroll to a heading/offset requested by link following or search.
  useEffect(() => {
    const view = viewRef.current
    if (!view || !anchor || anchor.path !== pane.active || useWorkspace.getState().activePane !== paneIdx) return
    let pos: number | null = anchor.offset ?? null
    if (anchor.heading) {
      const want = anchor.heading.toLowerCase()
      const h = parsedDoc(view.state).headings.find((x) => x.text.toLowerCase() === want)
      if (h) pos = h.from
    }
    if (pos != null && pos <= view.state.doc.length) {
      view.dispatch({ selection: EditorSelection.cursor(pos), effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 80 }) })
      view.focus()
    }
    useWorkspace.getState().clearAnchor()
  }, [anchor, pane.active, paneIdx])

  const keepMine = async () => {
    const entry = entryRef.current
    const view = viewRef.current
    if (!entry || !view) return
    entry.synced = session.index.get(entry.holder.path)?.text ?? entry.synced
    await flush(entry)()
    setConflict(false)
  }
  const loadTheirs = () => {
    const entry = entryRef.current
    const view = viewRef.current
    const note = entry && session.index.get(entry.holder.path)
    if (!entry || !view || !note) return
    const t = timers.current.get(entry)
    if (t) clearTimeout(t)
    timers.current.delete(entry)
    setPending(pendingKeys.current.get(entry) ?? '', null)
    pendingKeys.current.delete(entry)
    syncDoc(view, note.text)
    entry.synced = note.text
    setConflict(false)
  }

  return (
    <div className="editor-wrap">
      {conflict && (
        <div className="banner warn" role="alert">
          <span>This note changed on disk while you were editing it.</span>
          <button className="btn small" onClick={keepMine}>
            Keep my version
          </button>
          <button className="btn small" onClick={loadTheirs}>
            Load disk version
          </button>
        </div>
      )}
      <div ref={host} className="editor-host" hidden={!pane.active} />
    </div>
  )
}
