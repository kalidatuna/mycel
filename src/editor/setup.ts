import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { Annotation, EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, keymap, placeholder, rectangularSelection } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { mycelAutocomplete } from './autocomplete'
import type { EditorContext } from './context'
import { formattingKeymap } from './formatting'
import { linkClicks, livePreview } from './livePreview'

/** Marks transactions that sync in text from disk; they don't trigger a save. */
export const fromDisk = Annotation.define<boolean>()

const highlight = HighlightStyle.define([
  { tag: t.heading, fontWeight: '650', color: 'var(--text-strong)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.link, color: 'var(--accent)' },
  { tag: t.url, color: 'var(--text-muted)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)' },
  { tag: t.quote, color: 'var(--text-muted)' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: 'var(--text-faint)' },
  { tag: t.list, color: 'var(--text-muted)' },
  { tag: [t.keyword, t.tagName], color: 'var(--syntax-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syntax-string)' },
  { tag: [t.comment], color: 'var(--text-faint)', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.atom], color: 'var(--syntax-number)' },
])

export function editorExtensions(ctx: EditorContext, onDocChange: (text: string) => void): Extension[] {
  return [
    history(),
    drawSelection(),
    rectangularSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    closeBrackets(),
    search({ top: true }),
    indentUnit.of('    '),
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, addKeymap: true }),
    syntaxHighlighting(highlight),
    mycelAutocomplete(ctx),
    livePreview(ctx),
    linkClicks(ctx),
    placeholder('Start writing… type [[ to link a note, # for a tag'),
    keymap.of([...formattingKeymap, ...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
    EditorView.contentAttributes.of({ 'aria-label': 'Note editor', spellcheck: 'true', autocorrect: 'on' }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged && !u.transactions.some((tr) => tr.annotation(fromDisk))) onDocChange(u.state.doc.toString())
    }),
  ]
}

export function createState(text: string, ctx: EditorContext, onDocChange: (text: string) => void) {
  return EditorState.create({ doc: text, extensions: editorExtensions(ctx, onDocChange) })
}
