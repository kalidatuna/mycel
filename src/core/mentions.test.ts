import { describe, expect, it } from 'vitest'
import { mentionToLink, unlinkedMentions } from './mentions'
import { demoIndex, indexOf } from './testVault'

describe('unlinkedMentions', () => {
  it('finds title and alias mentions, not inside links, code or words', () => {
    const idx = indexOf({
      'Zone 2.md': '---\naliases: [easy pace]\n---\n',
      'a.md': 'Did zone 2 today. [[Zone 2]] `Zone 2` Zone 20 Easy pace felt fine. #Zone',
    })
    const m = unlinkedMentions(idx, 'Zone 2.md')
    expect(m.map((x) => x.match)).toEqual(['zone 2', 'Easy pace'])
    expect(mentionToLink('zone 2', 'Zone 2')).toBe('[[Zone 2|zone 2]]')
    expect(mentionToLink('Zone 2', 'Zone 2')).toBe('[[Zone 2]]')
  })

  it('finds the planted mentions in the demo vault', () => {
    const idx = demoIndex()
    const sources = unlinkedMentions(idx, 'Running/Zone 2 Training.md').map((m) => m.source)
    expect(sources).toContain('Daily/2026-03-19.md')
    expect(unlinkedMentions(idx, 'Engineering/Caching Strategies.md').map((m) => m.source)).toContain('Engineering/Incident 2026-05-19 Cache Stampede.md')
  })
})
