import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import type { EditorContext } from './context'

/** Insert `text`, then step over an existing `]]` (auto-closed brackets) or add one. */
function insertLink(text: string) {
  return (view: EditorView, _c: Completion, from: number, to: number) => {
    const after = view.state.sliceDoc(to, to + 2)
    const close = after === ']]' ? '' : ']]'
    const end = from + text.length + 2
    view.dispatch({ changes: { from, to, insert: text + close }, selection: { anchor: end } })
  }
}

function wikilinks(ctx: EditorContext) {
  return (cx: CompletionContext): CompletionResult | null => {
    const m = cx.matchBefore(/\[\[[^[\]\n|]*$/)
    if (!m) return null
    const query = m.text.slice(2)
    const hash = query.indexOf('#')
    if (hash >= 0) {
      const target = query.slice(0, hash)
      const from = m.from + 2 + hash + 1
      return {
        from,
        options: ctx.headingsOf(target || ctx.path()).map((h) => ({ label: h, type: 'heading', apply: insertLink(h) })),
        validFor: /^[^[\]\n|#]*$/,
      }
    }
    const options: Completion[] = []
    for (const n of ctx.noteTitles()) {
      const target = n.unique ? n.title : n.path.replace(/\.md$/i, '')
      const folder = n.path.includes('/') ? n.path.slice(0, n.path.lastIndexOf('/')) : ''
      options.push({ label: n.title, detail: folder, type: 'note', apply: insertLink(target) })
      for (const a of n.aliases) options.push({ label: a, detail: `→ ${n.title}`, type: 'alias', apply: insertLink(`${target}|${a}`) })
    }
    return { from: m.from + 2, options, validFor: /^[^[\]\n|#]*$/ }
  }
}

function tags(ctx: EditorContext) {
  return (cx: CompletionContext): CompletionResult | null => {
    const m = cx.matchBefore(/(?:^|\s)#[\p{L}\p{N}_\-/]*$/u)
    if (!m || (m.text.trim() === '#' && !cx.explicit && /^\s*#$/.test(cx.state.doc.lineAt(cx.pos).text))) return null
    const hashAt = m.from + m.text.indexOf('#')
    return { from: hashAt + 1, options: ctx.allTags().map((t) => ({ label: t, type: 'tag' })), validFor: /^[\p{L}\p{N}_\-/]*$/u }
  }
}

export const mycelAutocomplete = (ctx: EditorContext) =>
  autocompletion({ override: [wikilinks(ctx), tags(ctx)], icons: false, activateOnTyping: true, maxRenderedOptions: 40 })
