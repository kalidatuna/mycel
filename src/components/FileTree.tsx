import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { movePath, newFolderIn, newNoteIn, renamePath, trashPath } from '../commands/builtin'
import { basename, dirname, stripMd } from '../core/paths'
import { useVault } from '../store/vault'
import { useWorkspace } from '../store/workspace'
import { toast } from '../store/ui'
import * as actions from '../vault/actions'
import { session } from '../vault/session'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { useVaultVersion } from './hooks'
import { Icon } from './Icon'

interface Node {
  path: string
  name: string
  isFolder: boolean
  children: Node[]
}

function buildTree(notes: string[], folders: string[]): Node {
  const root: Node = { path: '', name: '', isFolder: true, children: [] }
  const byPath = new Map<string, Node>([['', root]])
  const ensure = (path: string): Node => {
    let n = byPath.get(path)
    if (n) return n
    n = { path, name: basename(path), isFolder: true, children: [] }
    byPath.set(path, n)
    ensure(dirname(path)).children.push(n)
    return n
  }
  for (const f of folders) ensure(f)
  for (const p of notes) ensure(dirname(p)).children.push({ path: p, name: stripMd(basename(p)), isFolder: false, children: [] })
  const sort = (n: Node) => {
    n.children.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, undefined, { numeric: true }))
    n.children.forEach(sort)
  }
  sort(root)
  return root
}

export function FileTree() {
  const version = useVaultVersion()
  const folders = useVault((s) => s.folders)
  const active = useWorkspace((s) => s.panes[s.activePane]?.active ?? null)
  const open = useWorkspace((s) => s.open)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(active ? ancestors(active) : []))
  const [focus, setFocus] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  // Reveal the active note's folder when it changes.
  useEffect(() => {
    if (!active) return
    const anc = ancestors(active)
    setExpanded((s) => (anc.every((a) => s.has(a)) ? s : new Set([...s, ...anc])))
  }, [active])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tree = useMemo(() => buildTree([...session.index.notes.keys()], folders), [version, folders])

  const visible: Node[] = []
  const walk = (n: Node) => {
    for (const c of n.children) {
      visible.push(c)
      if (c.isFolder && expanded.has(c.path)) walk(c)
    }
  }
  walk(tree)
  const current = focus && visible.some((v) => v.path === focus) ? focus : (active ?? visible[0]?.path ?? null)

  const toggle = (path: string, to?: boolean) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (to ?? !n.has(path)) n.add(path)
      else n.delete(path)
      return n
    })

  const focusItem = (path: string) => {
    setFocus(path)
    requestAnimationFrame(() => (treeRef.current?.querySelector(`[data-path="${CSS.escape(path)}"]`) as HTMLElement | null)?.focus())
  }

  const activate = (n: Node, newTab = false) => (n.isFolder ? toggle(n.path) : open(n.path, { newTab }))

  const onKey = (e: KeyboardEvent, n: Node) => {
    const i = visible.findIndex((v) => v.path === n.path)
    const go = (j: number) => visible[j] && focusItem(visible[j]!.path)
    switch (e.key) {
      case 'ArrowDown':
        go(i + 1)
        break
      case 'ArrowUp':
        go(i - 1)
        break
      case 'Home':
        go(0)
        break
      case 'End':
        go(visible.length - 1)
        break
      case 'ArrowRight':
        if (n.isFolder && !expanded.has(n.path)) toggle(n.path, true)
        else if (n.isFolder) go(i + 1)
        break
      case 'ArrowLeft':
        if (n.isFolder && expanded.has(n.path)) toggle(n.path, false)
        else if (dirname(n.path)) focusItem(dirname(n.path))
        break
      case 'Enter':
        activate(n, e.ctrlKey || e.metaKey)
        break
      case 'F2':
        void renamePath(n.path, n.isFolder)
        break
      case 'Delete':
        void trashPath(n.path, n.isFolder)
        break
      default:
        return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const menuFor = (n: Node | null): MenuItem[] => {
    const folder = n ? (n.isFolder ? n.path : dirname(n.path)) : ''
    const items: MenuItem[] = [
      { label: 'New note', icon: 'file-plus', run: () => newNoteIn(folder) },
      { label: 'New folder', icon: 'folder-plus', run: () => newFolderIn(folder) },
    ]
    if (n) {
      if (!n.isFolder) items.unshift({ label: 'Open in new tab', icon: 'file', run: () => open(n.path, { newTab: true }) })
      items.push(
        { separator: true },
        { label: 'Rename…', icon: 'edit', hint: 'F2', run: () => renamePath(n.path, n.isFolder) },
        { label: 'Move to…', icon: 'folder', run: () => movePath(n.path, n.isFolder) },
        { label: 'Move to trash', icon: 'trash', hint: 'Del', danger: true, run: () => trashPath(n.path, n.isFolder) },
      )
    }
    return items
  }

  const onContext = (e: MouseEvent, n: Node | null) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items: menuFor(n) })
  }

  const onDrop = async (e: DragEvent, folder: string) => {
    e.preventDefault()
    setDropTarget(null)
    const src = e.dataTransfer.getData('application/x-mycel-path')
    const isFolder = e.dataTransfer.getData('application/x-mycel-kind') === 'dir'
    if (!src || dirname(src) === folder || folder === src || folder.startsWith(src + '/')) return
    try {
      if (isFolder) await actions.moveFolder(src, folder)
      else await actions.moveNote(src, folder)
      if (folder) toggle(folder, true)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  const renderNode = (n: Node, depth: number) => {
    const isOpen = expanded.has(n.path)
    const dropFolder = n.isFolder ? n.path : dirname(n.path)
    return (
      <div key={n.path} role="none">
        <div
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={n.isFolder ? isOpen : undefined}
          aria-selected={n.path === active}
          tabIndex={n.path === current ? 0 : -1}
          data-path={n.path}
          className={'tree-item' + (n.path === active ? ' active' : '') + (dropTarget === n.path && n.isFolder ? ' drop' : '')}
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={(e) => {
            setFocus(n.path)
            activate(n, e.ctrlKey || e.metaKey)
          }}
          onKeyDown={(e) => onKey(e, n)}
          onContextMenu={(e) => onContext(e, n)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-mycel-path', n.path)
            e.dataTransfer.setData('application/x-mycel-kind', n.isFolder ? 'dir' : 'file')
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDropTarget(n.isFolder ? n.path : dirname(n.path) || null)
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => {
            e.stopPropagation()
            void onDrop(e, dropFolder)
          }}
        >
          {n.isFolder ? <Icon name="chevron" size={14} className={'chev' + (isOpen ? ' open' : '')} /> : <span className="chev-pad" />}
          <span className="tree-name">{n.name}</span>
        </div>
        {n.isFolder && isOpen && (
          <div role="group">{n.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="file-tree">
      <div className="panel-head">
        <span>Files</span>
        <div className="panel-actions">
          <button className="icon-btn small" title="New note" aria-label="New note" onClick={() => newNoteIn('')}>
            <Icon name="file-plus" size={16} />
          </button>
          <button className="icon-btn small" title="New folder" aria-label="New folder" onClick={() => newFolderIn('')}>
            <Icon name="folder-plus" size={16} />
          </button>
        </div>
      </div>
      <div
        ref={treeRef}
        role="tree"
        aria-label="Notes"
        className={'tree scroll' + (dropTarget === '' ? ' drop-root' : '')}
        onContextMenu={(e) => onContext(e, null)}
        onDragOver={(e) => {
          e.preventDefault()
          setDropTarget('')
        }}
        onDrop={(e) => void onDrop(e, '')}
      >
        {tree.children.length === 0 ? <p className="empty">No notes yet. Create one to get started.</p> : tree.children.map((c) => renderNode(c, 0))}
      </div>
      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
    </div>
  )
}

function ancestors(path: string): string[] {
  const out: string[] = []
  for (let d = dirname(path); d; d = dirname(d)) out.push(d)
  return out
}
