import { describe, expect, it } from 'vitest'
import { planRename } from './rewrite'
import { indexOf } from './testVault'

describe('planRename', () => {
  it('rewrites only the target span, keeping alias, heading and surrounding bytes', () => {
    const idx = indexOf({
      'Old.md': 'self [[#Top]] and [[Old#Top]]',
      'src.md': '---\nk: [[Old]]\n---\nA [[Old]], [[Old|alias]], [[old#Sec|x]], ![[Old]] `[[Old]]` [[Other]]\n',
      'Other.md': '',
    })
    const plan = planRename(idx, 'Old.md', 'folder/New.md')
    expect(plan.get('src.md')).toBe('---\nk: [[Old]]\n---\nA [[New]], [[New|alias]], [[New#Sec|x]], ![[New]] `[[Old]]` [[Other]]\n')
    expect(plan.get('Old.md')).toBe('self [[#Top]] and [[New#Top]]')
    expect(plan.has('Other.md')).toBe(false)
  })

  it('keeps path style and .md suffix', () => {
    const idx = indexOf({ 'a/Old.md': '', 'src.md': '[[a/Old]] [[Old.md]] [[a/Old.md|t]]' })
    expect(planRename(idx, 'a/Old.md', 'b/New.md').get('src.md')).toBe('[[b/New]] [[New.md]] [[b/New.md|t]]')
  })

  it('uses a path when the new name collides with another note', () => {
    const idx = indexOf({ 'Old.md': '', 'x/Taken.md': '', 'src.md': '[[Old]]' })
    expect(planRename(idx, 'Old.md', 'y/Taken.md').get('src.md')).toBe('[[y/Taken]]')
  })

  it('moving without renaming changes nothing for bare links', () => {
    const idx = indexOf({ 'Old.md': '', 'src.md': '[[Old]]' })
    expect(planRename(idx, 'Old.md', 'deep/Old.md').size).toBe(0)
  })

  it('does not touch links that resolve to a different same-named note', () => {
    const idx = indexOf({ 'a/Same.md': '', 'b/Same.md': '', 'b/src.md': '[[Same]]', 'a/src.md': '[[Same]]' })
    const plan = planRename(idx, 'a/Same.md', 'a/Renamed.md')
    expect(plan.get('a/src.md')).toBe('[[Renamed]]')
    expect(plan.has('b/src.md')).toBe(false)
  })
})
