import { StateEffect } from '@codemirror/state'

/** Per-pane hooks the editor extensions call back into. */
export interface EditorContext {
  path(): string
  /** Does this link target resolve to an existing note/asset? */
  resolves(target: string): boolean
  followLink(target: string, heading: string | undefined, newTab: boolean): void
  openUrl(url: string): void
  searchTag(tag: string): void
  noteTitles(): { title: string; path: string; aliases: string[]; unique: boolean }[]
  headingsOf(target: string): string[]
  allTags(): string[]
}

/** Dispatched when link resolution may have changed (vault changed) so decorations redraw. */
export const refreshEffect = StateEffect.define<null>()
