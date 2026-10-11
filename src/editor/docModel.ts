import type { EditorState } from '@codemirror/state'
import { findFrontmatter } from '../core/frontmatter'
import { parseNote, type ParsedNote } from '../core/parse'

/** Parse of the current document, cached per document version. */
const cache = new WeakMap<object, ParsedNote>()

export function parsedDoc(state: EditorState): ParsedNote {
  const doc = state.doc
  let p = cache.get(doc)
  if (!p) {
    p = parseNote(doc.toString())
    cache.set(doc, p)
  }
  return p
}

export function frontmatterEnd(state: EditorState): number {
  if (!state.doc.sliceString(0, 3).startsWith('---')) return 0
  return parsedDoc(state).frontmatter?.end ?? findFrontmatter(state.doc.toString())?.end ?? 0
}
