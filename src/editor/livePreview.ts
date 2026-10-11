import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { refreshEffect, type EditorContext } from './context'
import { frontmatterEnd, parsedDoc } from './docModel'
import { BulletWidget, CheckboxWidget, RuleWidget } from './widgets'

const hide = Decoration.replace({})
const line = (cls: string) => Decoration.line({ class: cls })
const mark = (cls: string, attrs?: Record<string, string>) => Decoration.mark({ class: cls, attributes: attrs })

/** Line numbers that contain a selection: markdown syntax is shown raw there. */
function activeLines(state: EditorState, focused: boolean): Set<number> {
  const out = new Set<number>()
  if (!focused) return out
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number
    const b = state.doc.lineAt(r.to).number
    for (let i = a; i <= b; i++) out.add(i)
  }
  return out
}

function build(view: EditorView, ctx: EditorContext): DecorationSet {
  const { state } = view
  const decos: Range<Decoration>[] = []
  const active = activeLines(state, view.hasFocus)
  const isActive = (pos: number) => active.has(state.doc.lineAt(pos).number)
  const fmEnd = frontmatterEnd(state)

  if (fmEnd > 0) {
    const last = state.doc.lineAt(Math.max(0, fmEnd - 1)).number
    for (let i = 1; i <= last; i++) decos.push(line(i === 1 ? 'cm-fm cm-fm-first' : i === last ? 'cm-fm cm-fm-last' : 'cm-fm').range(state.doc.line(i).from))
  }

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from: Math.max(from, fmEnd),
      to,
      enter: (node) => {
        if (node.from < fmEnd) return
        const name = node.name
        const h = /^ATXHeading(\d)$/.exec(name) ?? /^SetextHeading(\d)$/.exec(name)
        if (h) {
          decos.push(line(`cm-h cm-h${h[1]}`).range(state.doc.lineAt(node.from).from))
          return
        }
        switch (name) {
          case 'HeaderMark': {
            if (isActive(node.from) || state.doc.lineAt(node.from).from !== node.from) return
            const next = state.sliceDoc(node.to, node.to + 1)
            decos.push(hide.range(node.from, next === ' ' ? node.to + 1 : node.to))
            return
          }
          case 'EmphasisMark':
          case 'StrikethroughMark':
          case 'CodeMark':
            if (name === 'CodeMark' && node.node.parent?.name === 'FencedCode') return
            if (!isActive(node.from) && node.to > node.from) decos.push(hide.range(node.from, node.to))
            return
          case 'InlineCode':
            decos.push(mark('cm-inline-code').range(node.from, node.to))
            return
          case 'Link': {
            const marks = node.node.getChildren('LinkMark')
            const url = node.node.getChild('URL')
            if (marks.length < 2) return
            const textFrom = marks[0]!.to
            const textTo = marks[1]!.from
            if (textTo > textFrom) decos.push(mark('cm-md-link', { 'data-url': url ? state.sliceDoc(url.from, url.to) : '' }).range(textFrom, textTo))
            if (!isActive(node.from)) {
              decos.push(hide.range(node.from, textFrom))
              decos.push(hide.range(textTo, node.to))
            }
            return false
          }
          case 'Blockquote': {
            for (let p = node.from; p <= node.to; ) {
              const l = state.doc.lineAt(p)
              decos.push(line('cm-quote').range(l.from))
              p = l.to + 1
            }
            return
          }
          case 'QuoteMark':
            if (!isActive(node.from)) {
              const next = state.sliceDoc(node.to, node.to + 1)
              decos.push(hide.range(node.from, next === ' ' ? node.to + 1 : node.to))
            }
            return
          case 'HorizontalRule':
            if (!isActive(node.from)) decos.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to))
            return
          case 'FencedCode': {
            const first = state.doc.lineAt(node.from).number
            const last = state.doc.lineAt(node.to).number
            for (let i = first; i <= last; i++) {
              const cls = 'cm-codeblock' + (i === first ? ' cm-codeblock-first' : '') + (i === last ? ' cm-codeblock-last' : '')
              decos.push(line(cls).range(state.doc.line(i).from))
            }
            return
          }
          case 'ListMark': {
            const parentList = node.node.parent?.parent?.name
            const task = node.node.nextSibling?.name === 'Task'
            const ln = state.doc.lineAt(node.from)
            const lead = node.from - ln.from
            // Hanging indent so wrapped list lines align with the text, not the marker.
            const hang = task ? 'calc(21px' : parentList === 'BulletList' ? 'calc(1.05em' : `calc(${node.to - node.from + 1}ch`
            decos.push(Decoration.line({ attributes: { style: `padding-left: ${hang} + ${lead}ch) !important; text-indent: calc(-1 * (${hang} + ${lead}ch)))` } }).range(ln.from))
            if (isActive(node.from)) return
            if (task) {
              decos.push(hide.range(node.from, Math.min(node.to + 1, state.doc.lineAt(node.from).to)))
            } else if (parentList === 'BulletList') {
              decos.push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to))
            }
            return
          }
          case 'TaskMarker': {
            const checked = /x/i.test(state.sliceDoc(node.from, node.to))
            const sel = state.selection.main
            const touching = view.hasFocus && sel.from <= node.to && sel.to >= node.from
            if (!touching) decos.push(Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to))
            if (checked) decos.push(line('cm-task-done').range(state.doc.lineAt(node.from).from))
            return
          }
        }
      },
    })
  }

  // Wikilinks and tags come from Mycel's own parser (code and comments already excluded).
  const parsed = parsedDoc(state)
  const vis = view.visibleRanges
  const visible = (a: number, b: number) => vis.some((r) => b >= r.from && a <= r.to)
  for (const l of parsed.links) {
    if (!visible(l.from, l.to)) continue
    const broken = l.target !== '' && !ctx.resolves(l.target)
    const cls = 'cm-wikilink' + (broken ? ' cm-wikilink-broken' : '') + (l.embed ? ' cm-wikilink-embed' : '')
    const title = broken ? `"${l.target}" does not exist yet — click to create it` : l.target || `#${l.heading ?? ''}`
    const innerFrom = l.from + (l.embed ? 3 : 2)
    const innerTo = l.to - 2
    if (isActive(l.from)) {
      decos.push(mark(cls, { title }).range(l.from, l.to))
      continue
    }
    decos.push(hide.range(l.from, innerFrom))
    const pipe = state.sliceDoc(innerFrom, innerTo).indexOf('|')
    if (pipe >= 0) {
      decos.push(hide.range(innerFrom, innerFrom + pipe + 1))
      decos.push(mark(cls, { title }).range(innerFrom + pipe + 1, innerTo))
    } else decos.push(mark(cls, { title }).range(innerFrom, innerTo))
    decos.push(hide.range(innerTo, l.to))
  }
  for (const t of parsed.tags) {
    if (t.source === 'inline' && visible(t.from, t.to)) decos.push(mark('cm-tag', { 'data-tag': t.name }).range(t.from, t.to))
  }
  return Decoration.set(decos, true)
}

export function livePreview(ctx: EditorContext) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = build(view, ctx)
      }
      update(u: ViewUpdate) {
        const refresh = u.transactions.some((tr) => tr.effects.some((e) => e.is(refreshEffect)))
        if (u.docChanged || u.viewportChanged || u.selectionSet || u.focusChanged || refresh || syntaxTree(u.startState) !== syntaxTree(u.state)) {
          this.decorations = build(u.view, ctx)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

/** Click handling for rendered links, tags and markdown links. */
export function linkClicks(ctx: EditorContext) {
  return EditorView.domEventHandlers({
    mousedown(e, view) {
      if (e.button !== 0) return false
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
      if (pos == null) return false
      const mod = e.ctrlKey || e.metaKey
      const lineNo = view.state.doc.lineAt(pos).number
      const onActive = view.hasFocus && view.state.selection.ranges.some((r) => view.state.doc.lineAt(r.head).number === lineNo)
      if (onActive && !mod) return false
      const link = parsedDoc(view.state).links.find((l) => pos >= l.from && pos <= l.to)
      if (link) {
        e.preventDefault()
        ctx.followLink(link.target, link.heading, mod && onActive ? false : mod)
        return true
      }
      const el = e.target as HTMLElement
      const md = el.closest('.cm-md-link') as HTMLElement | null
      if (md?.dataset.url) {
        e.preventDefault()
        ctx.openUrl(md.dataset.url)
        return true
      }
      const tag = el.closest('.cm-tag') as HTMLElement | null
      if (tag?.dataset.tag) {
        e.preventDefault()
        ctx.searchTag(tag.dataset.tag)
        return true
      }
      return false
    },
  })
}
