import { describe, expect, it } from 'vitest'
import { TextSearch, makeSnippet } from './search'
import { demoIndex } from './testVault'
import { applyTemplate } from './templates'

describe('TextSearch', () => {
  const idx = demoIndex()
  const s = new TextSearch()
  s.build(idx.notes.values())

  it('ranks title matches first and returns highlighted snippets', () => {
    const hits = s.search('hydration')
    expect(hits[0]!.path).toBe('Baking/Sourdough Hydration.md')
    expect(hits[0]!.snippet.parts.some((p) => p.hit && /hydration/i.test(p.text))).toBe(true)
  })

  it('matches prefixes and multiple terms', () => {
    expect(s.search('stamped cache').map((h) => h.path)).toContain('Engineering/Incident 2026-05-19 Cache Stampede.md')
  })

  it('updates incrementally', () => {
    const note = idx.upsert({ path: 'New.md', text: 'xylophone practice', mtime: 0 })
    s.update(note)
    expect(s.search('xylophone')[0]!.path).toBe('New.md')
    s.remove('New.md')
    expect(s.search('xylophone')).toEqual([])
  })

  it('makeSnippet windows long text', () => {
    const body = 'lorem '.repeat(100) + 'needle ' + 'ipsum '.repeat(100)
    const sn = makeSnippet(body, ['needle'])
    expect(sn.parts[0]!.text).toBe('…')
    expect(sn.parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['needle'])
  })
})

describe('templates', () => {
  it('fills placeholders', () => {
    const d = new Date(2026, 0, 5, 9, 7)
    expect(applyTemplate('# {{title}} {{date}} {{ time }} {{other}}', { title: 'T', date: d })).toBe('# T 2026-01-05 09:07 {{other}}')
  })
})
