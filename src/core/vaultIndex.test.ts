import { describe, expect, it } from 'vitest'
import { demoIndex, indexOf } from './testVault'

describe('VaultIndex resolution', () => {
  it('resolves bare names case-insensitively, paths, and .md suffixes', () => {
    const idx = indexOf({ 'a/Note.md': '', 'b/Other.md': '', 'x.md': '[[note]] [[b/Other]] [[Other.md]] [[Missing]]' })
    expect(idx.outgoing.get('x.md')!.map((l) => l.resolved)).toEqual(['a/Note.md', 'b/Other.md', 'b/Other.md', null])
    expect(idx.backlinksOf('a/Note.md')).toEqual(['x.md'])
  })

  it('prefers the same folder, then the shortest path for duplicate names', () => {
    const idx = indexOf({ 'Dup.md': '', 'deep/er/Dup.md': '', 'deep/er/src.md': '[[Dup]]', 'top.md': '[[Dup]]' })
    expect(idx.outgoing.get('deep/er/src.md')![0]!.resolved).toBe('deep/er/Dup.md')
    expect(idx.outgoing.get('top.md')![0]!.resolved).toBe('Dup.md')
  })

  it('re-resolves when a missing target is created and when a target is removed', () => {
    const idx = indexOf({ 'a.md': '[[New Note]]' })
    expect(idx.unresolved().has('New Note')).toBe(true)
    idx.upsert({ path: 'folder/New Note.md', text: '', mtime: 1 })
    expect(idx.backlinksOf('folder/New Note.md')).toEqual(['a.md'])
    idx.remove('folder/New Note.md')
    expect(idx.outgoing.get('a.md')![0]!.resolved).toBeNull()
    expect(idx.backlinks.has('folder/New Note.md')).toBe(false)
  })

  it('updates backlinks when a note changes', () => {
    const idx = indexOf({ 'a.md': '[[b]]', 'b.md': '', 'c.md': '' })
    idx.upsert({ path: 'a.md', text: '[[c]]', mtime: 2 })
    expect(idx.backlinksOf('b.md')).toEqual([])
    expect(idx.backlinksOf('c.md')).toEqual(['a.md'])
  })

  it('collects tags across inline and frontmatter, case-insensitive', () => {
    const idx = indexOf({ 'a.md': '---\ntags: [Coffee]\n---\n#coffee', 'b.md': '#coffee/v60' })
    const tags = idx.tags()
    expect([...tags.get('coffee')!.paths]).toEqual(['a.md'])
    expect(tags.get('coffee')!.label).toBe('Coffee')
    expect(tags.has('coffee/v60')).toBe(true)
  })

  it('uses frontmatter created date when present', () => {
    const idx = indexOf({ 'a.md': '---\ncreated: 2026-01-12\n---\n' })
    expect(new Date(idx.get('a.md')!.created).toISOString().slice(0, 10)).toBe('2026-01-12')
  })
})

describe('demo vault', () => {
  const idx = demoIndex()
  it('loads all notes with links resolved', () => {
    expect(idx.size).toBeGreaterThanOrEqual(60)
    expect(idx.backlinksOf('Projects/Atlas Migration.md').length).toBeGreaterThanOrEqual(4)
  })
  it('has the deliberate broken links', () => {
    const broken = [...idx.unresolved().keys()]
    expect(broken).toEqual(expect.arrayContaining(['Mechanical Keyboards', 'Service Mesh']))
  })
  it('has orphans', () => {
    const orphans = [...idx.notes.keys()].filter((p) => idx.backlinksOf(p).length === 0 && (idx.outgoing.get(p) ?? []).length === 0)
    expect(orphans).toEqual(expect.arrayContaining(['Gift Ideas.md', 'Bike Tune-up Checklist.md', 'Quotes I Like.md', 'Japanese/Katakana Drills.md']))
  })
})
