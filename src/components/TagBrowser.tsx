import { useMemo, useState } from 'react'
import { useUi } from '../store/ui'
import { session } from '../vault/session'
import { useVaultVersion } from './hooks'
import { Icon } from './Icon'

interface TagNode {
  name: string
  full: string
  count: number
  children: TagNode[]
}

export function TagBrowser() {
  const version = useVaultVersion()
  const [sort, setSort] = useState<'count' | 'name'>('count')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const showTag = (t: string) => {
    useUi.getState().setSearchQuery(`tag:${t}`)
    useUi.getState().setLeftTab('search')
  }

  const roots = useMemo(() => {
    const byFull = new Map<string, TagNode>()
    const roots: TagNode[] = []
    const ensure = (full: string): TagNode => {
      let n = byFull.get(full)
      if (n) return n
      const i = full.lastIndexOf('/')
      n = { name: i === -1 ? full : full.slice(i + 1), full, count: 0, children: [] }
      byFull.set(full, n)
      if (i === -1) roots.push(n)
      else ensure(full.slice(0, i)).children.push(n)
      return n
    }
    for (const [, { label, paths }] of session.index.tags()) ensure(label).count += paths.size
    const cmp = (a: TagNode, b: TagNode) => (sort === 'count' ? b.count - a.count : 0) || a.name.localeCompare(b.name)
    const sortRec = (ns: TagNode[]) => {
      ns.sort(cmp)
      ns.forEach((n) => sortRec(n.children))
    }
    sortRec(roots)
    return roots
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, sort])

  const render = (n: TagNode, depth: number) => (
    <li key={n.full}>
      <div className="tag-row" style={{ paddingLeft: 8 + depth * 14 }}>
        {n.children.length ? (
          <button
            className="icon-btn small"
            aria-label={collapsed.has(n.full) ? `Expand ${n.full}` : `Collapse ${n.full}`}
            onClick={() =>
              setCollapsed((s) => {
                const x = new Set(s)
                if (x.has(n.full)) x.delete(n.full)
                else x.add(n.full)
                return x
              })
            }
          >
            <Icon name="chevron" size={13} className={'chev' + (collapsed.has(n.full) ? '' : ' open')} />
          </button>
        ) : (
          <span className="chev-pad" />
        )}
        <button className="tag-pill" onClick={() => showTag(n.full)}>
          #{n.name}
        </button>
        <span className="count">{n.count}</span>
      </div>
      {n.children.length > 0 && !collapsed.has(n.full) && <ul>{n.children.map((c) => render(c, depth + 1))}</ul>}
    </li>
  )

  return (
    <div className="tag-browser">
      <div className="panel-head">
        <span>Tags</span>
        <div className="panel-actions">
          <button className="btn ghost small" onClick={() => setSort(sort === 'count' ? 'name' : 'count')} aria-label="Change tag sort order">
            {sort === 'count' ? 'By count' : 'A–Z'}
          </button>
        </div>
      </div>
      <ul className="tag-list scroll">{roots.length ? roots.map((r) => render(r, 0)) : <li className="empty">No tags yet. Add #tags in notes or a tags: list in frontmatter.</li>}</ul>
    </div>
  )
}
