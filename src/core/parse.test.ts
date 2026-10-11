import { describe, expect, it } from 'vitest'
import { parseNote } from './parse'
import { findFrontmatter, setFrontmatterScalar } from './frontmatter'

describe('parseNote links', () => {
  it('parses plain, alias, heading and embed links with offsets', () => {
    const text = 'See [[Note]], [[Other|nice name]], [[Deep#Section two]] and ![[pic.png]].'
    const { links } = parseNote(text)
    expect(links.map((l) => [l.target, l.alias, l.heading, l.embed])).toEqual([
      ['Note', undefined, undefined, false],
      ['Other', 'nice name', undefined, false],
      ['Deep', undefined, 'Section two', false],
      ['pic.png', undefined, undefined, true],
    ])
    for (const l of links) expect(text.slice(l.targetFrom, l.targetTo)).toBe(l.target)
    expect(text.slice(links[1]!.from, links[1]!.to)).toBe('[[Other|nice name]]')
  })

  it('handles heading-only links and whitespace', () => {
    const { links } = parseNote('[[#Top]] [[  Spaced  |a]]')
    expect(links[0]).toMatchObject({ target: '', heading: 'Top' })
    expect(links[1]).toMatchObject({ target: 'Spaced', alias: 'a' })
  })

  it('ignores links in code fences, inline code and comments', () => {
    const text = '```\n[[InFence]]\n```\n`[[Inline]]` <!-- [[Comment]] -->\n~~~js\n#notatag\n~~~\n[[Real]]'
    const { links, tags } = parseNote(text)
    expect(links.map((l) => l.target)).toEqual(['Real'])
    expect(tags).toEqual([])
  })

  it('ignores an unclosed fence to the end of the file', () => {
    expect(parseNote('[[A]]\n```\n[[B]]').links.map((l) => l.target)).toEqual(['A'])
  })
})

describe('parseNote tags', () => {
  it('finds inline tags and skips headings, numbers, urls and link headings', () => {
    const text = '# Heading\n#tag at start, mid #nested/tag, #2026 no, url http://x.com/#frag, [[N#h]] (#paren) #café'
    const names = parseNote(text).tags.map((t) => t.name)
    expect(names).toEqual(['tag', 'nested/tag', 'paren', 'café'])
  })

  it('reads frontmatter tags as list or string', () => {
    expect(parseNote('---\ntags: [a, "#b"]\n---\n').tags.map((t) => t.name)).toEqual(['a', 'b'])
    expect(parseNote('---\ntags: x y, z\n---\n').tags.map((t) => t.name)).toEqual(['x', 'y', 'z'])
    expect(parseNote('---\ntags:\n  - one\n  - two\n---\n').tags.map((t) => [t.name, t.source])).toEqual([
      ['one', 'frontmatter'],
      ['two', 'frontmatter'],
    ])
  })

  it('does not read frontmatter text as inline tags', () => {
    const p = parseNote('---\ncolor: "#ff0000"\n---\nbody #real')
    expect(p.tags.map((t) => t.name)).toEqual(['real'])
  })
})

describe('frontmatter', () => {
  it('parses and reports offsets', () => {
    const text = '---\ntitle: Hi\naliases: [A, B]\n---\nBody'
    const fm = findFrontmatter(text)!
    expect(fm.data).toEqual({ title: 'Hi', aliases: ['A', 'B'] })
    expect(text.slice(fm.end)).toBe('Body')
    expect(parseNote(text).aliases).toEqual(['A', 'B'])
  })

  it('returns null without a closing fence and keeps broken yaml as an error', () => {
    expect(findFrontmatter('---\na: 1\nno close')).toBeNull()
    const fm = findFrontmatter('---\na: [1\n---\n')!
    expect(fm.error).toBeTruthy()
    expect(fm.data).toEqual({})
  })

  it('handles empty frontmatter and CRLF', () => {
    expect(findFrontmatter('---\n---\nx')!.end).toBe(8)
    const crlf = '---\r\na: 1\r\n---\r\nx'
    expect(crlf.slice(findFrontmatter(crlf)!.end)).toBe('x')
  })

  it('setFrontmatterScalar only touches one line', () => {
    const text = '---\n# comment\nstatus: draft   \ntags: [a]\n---\nbody'
    expect(setFrontmatterScalar(text, 'status', 'done')).toBe('---\n# comment\nstatus: done\ntags: [a]\n---\nbody')
    expect(setFrontmatterScalar(text, 'owner', 'me: you')).toBe('---\n# comment\nstatus: draft   \ntags: [a]\nowner: "me: you"\n---\nbody')
    expect(setFrontmatterScalar('body', 'k', 'v')).toBe('---\nk: v\n---\nbody')
  })
})

describe('headings', () => {
  it('finds ATX headings', () => {
    const h = parseNote('# One\ntext\n## Two ##\n####### seven').headings
    expect(h.map((x) => [x.level, x.text])).toEqual([[1, 'One'], [2, 'Two']])
  })
})
