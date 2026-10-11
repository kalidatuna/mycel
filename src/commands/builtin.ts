import { applyTemplate } from '../core/templates'
import { basename, dirname, join, stripMd } from '../core/paths'
import { insertAtCursor } from '../editor/formatting'
import { activePath, activeView } from '../editor/views'
import { dialogs, toast, useUi } from '../store/ui'
import { useVault } from '../store/vault'
import { useWorkspace } from '../store/workspace'
import * as actions from '../vault/actions'
import { session } from '../vault/session'
import { registerCommand, type Command } from './registry'

const ready = () => useVault.getState().status === 'ready'
const hasNote = () => ready() && !!activePath()

async function guard(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

export async function newNoteIn(folder: string) {
  const name = await dialogs.prompt('New note name', 'Untitled', 'Create', [0, 8])
  if (name == null) return
  const err = actions.validateName(name)
  if (err) return toast(err, 'error')
  await guard(() => actions.createNote(join(folder, `${name}.md`), `# ${name}\n\n`))
}

export async function newFolderIn(folder: string) {
  const name = await dialogs.prompt('New folder name', '', 'Create')
  if (!name) return
  const err = actions.validateName(name)
  if (err) return toast(err, 'error')
  await guard(() => actions.createFolder(join(folder, name)))
}

export async function renamePath(path: string, isFolder: boolean) {
  const current = isFolder ? basename(path) : stripMd(basename(path))
  const name = await dialogs.prompt(isFolder ? 'Rename folder' : 'Rename note', current, 'Rename', [0, current.length])
  if (!name || name === current) return
  const err = actions.validateName(name)
  if (err) return toast(err, 'error')
  const to = join(dirname(path), isFolder ? name : `${name}.md`)
  await guard(() => (isFolder ? actions.renameFolder(path, to) : actions.renameNote(path, to)))
}

export async function movePath(path: string, isFolder: boolean) {
  const folders = ['', ...useVault.getState().folders].filter((f) => !isFolder || (f !== path && !f.startsWith(path + '/')))
  const pick = await dialogs.pick(`Move "${basename(path)}" to…`, folders.map((f) => ({ id: f, label: f || '/ (vault root)' })))
  if (!pick || pick.id === dirname(path)) return
  await guard(() => (isFolder ? actions.moveFolder(path, pick.id) : actions.moveNote(path, pick.id)))
}

export async function trashPath(path: string, isFolder: boolean) {
  const ok = await dialogs.confirm(
    isFolder ? `Move folder "${basename(path)}" to trash?` : `Move "${stripMd(basename(path))}" to trash?`,
    'It will be moved to the .trash folder inside your vault. Nothing is permanently deleted.',
    'Move to trash',
    true,
  )
  if (!ok) return
  await guard(async () => {
    if (isFolder) await actions.trashFolder(path)
    else await actions.trashNote(path)
    toast('Moved to .trash', 'success')
  })
}

async function insertTemplate() {
  const view = activeView()
  const path = activePath()
  if (!view || !path) return toast('Open a note first', 'info')
  const tpls = actions.templates()
  if (!tpls.length) return toast('No templates yet. Add notes to a "Templates" folder.', 'info')
  const pick = await dialogs.pick('Insert template', tpls.map((t) => ({ id: t.path, label: t.title })))
  if (!pick) return
  const tpl = session.index.get(pick.id)
  if (tpl) insertAtCursor(view, applyTemplate(tpl.text, { title: stripMd(basename(path)) }))
}

const builtins: Command[] = [
  { id: 'switcher', name: 'Open quick switcher', hotkey: 'Mod+O', when: ready, run: () => useUi.getState().openModal({ kind: 'switcher' }) },
  { id: 'palette', name: 'Open command palette', hotkey: 'Mod+P', when: ready, run: () => useUi.getState().openModal({ kind: 'palette' }) },
  {
    id: 'search',
    name: 'Search all notes',
    hotkey: 'Mod+Shift+F',
    when: ready,
    run: () => {
      useUi.getState().setLeftTab('search')
      setTimeout(() => document.getElementById('global-search')?.focus(), 0)
    },
  },
  { id: 'new-note', name: 'New note', hotkey: 'Alt+N', when: ready, run: () => newNoteIn(dirname(activePath() ?? '')) },
  { id: 'new-folder', name: 'New folder', when: ready, run: () => newFolderIn('') },
  { id: 'daily', name: "Open today's daily note", hotkey: 'Alt+D', when: ready, run: () => guard(() => actions.openDailyNote()) },
  { id: 'template', name: 'Insert template', hotkey: 'Alt+T', when: hasNote, run: insertTemplate },
  { id: 'rename', name: 'Rename current note', hotkey: 'F2', when: hasNote, run: () => renamePath(activePath()!, false) },
  { id: 'move', name: 'Move current note to…', when: hasNote, run: () => movePath(activePath()!, false) },
  { id: 'trash', name: 'Move current note to trash', when: hasNote, run: () => trashPath(activePath()!, false) },
  { id: 'split', name: 'Split editor / switch pane', hotkey: 'Mod+\\', when: ready, run: () => useWorkspace.getState().split() },
  { id: 'close-tab', name: 'Close tab', hotkey: 'Alt+W', when: ready, run: () => useWorkspace.getState().closeActive() },
  { id: 'next-tab', name: 'Next tab', hotkey: 'Alt+.', when: ready, run: () => useWorkspace.getState().cycleTab(1) },
  { id: 'prev-tab', name: 'Previous tab', hotkey: 'Alt+,', when: ready, run: () => useWorkspace.getState().cycleTab(-1) },
  {
    id: 'theme',
    name: 'Toggle light/dark theme',
    hotkey: 'Alt+L',
    run: () => useUi.getState().setTheme(useUi.getState().theme === 'dark' ? 'light' : 'dark'),
  },
  { id: 'toggle-left', name: 'Toggle left sidebar', hotkey: 'Mod+Shift+[', when: ready, run: () => useUi.getState().toggleLeft() },
  { id: 'toggle-right', name: 'Toggle right sidebar', hotkey: 'Mod+Shift+]', when: ready, run: () => useUi.getState().toggleRight() },
  {
    id: 'files',
    name: 'Show file tree',
    hotkey: 'Mod+Shift+E',
    when: ready,
    run: () => {
      useUi.getState().setLeftTab('files')
      setTimeout(() => (document.querySelector('[role=tree] [tabindex="0"]') as HTMLElement | null)?.focus(), 0)
    },
  },
  { id: 'tags', name: 'Show tags', when: ready, run: () => useUi.getState().setLeftTab('tags') },
  { id: 'focus-editor', name: 'Focus editor', hotkey: 'Mod+E', when: hasNote, run: () => activeView()?.focus() },
  { id: 'close-vault', name: 'Close vault', when: ready, run: () => location.assign(location.pathname) },
]

export function registerBuiltins() {
  for (const c of builtins) registerCommand({ ...c, source: 'core' })
}
