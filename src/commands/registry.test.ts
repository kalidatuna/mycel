import { describe, expect, it } from 'vitest'
import { matchesHotkey } from './registry'

const ev = (init: Partial<KeyboardEvent>) => ({ key: '', code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init }) as KeyboardEvent

describe('matchesHotkey', () => {
  it('matches letters with modifiers exactly', () => {
    expect(matchesHotkey(ev({ key: 'o', code: 'KeyO', ctrlKey: true }), 'Mod+O')).toBe(true)
    expect(matchesHotkey(ev({ key: 'O', code: 'KeyO', ctrlKey: true, shiftKey: true }), 'Mod+O')).toBe(false)
    expect(matchesHotkey(ev({ key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true }), 'Mod+Shift+F')).toBe(true)
  })
  it('matches punctuation by physical key when Shift or Alt changes e.key', () => {
    expect(matchesHotkey(ev({ key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true }), 'Mod+Shift+[')).toBe(true)
    expect(matchesHotkey(ev({ key: '≥', code: 'Period', altKey: true }), 'Alt+.')).toBe(true)
    expect(matchesHotkey(ev({ key: '\\', code: 'Backslash', ctrlKey: true }), 'Mod+\\')).toBe(true)
  })
  it('matches function keys', () => {
    expect(matchesHotkey(ev({ key: 'F2', code: 'F2' }), 'F2')).toBe(true)
  })
})
