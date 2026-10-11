export interface Command {
  id: string
  name: string
  /** e.g. "Mod+Shift+F". Mod is Ctrl on Windows/Linux and Cmd on macOS. */
  hotkey?: string
  run(): void | Promise<void>
  /** Hide from the palette when this returns false. */
  when?(): boolean
  /** Who registered it ("core" or a plugin id). */
  source?: string
}

const commands = new Map<string, Command>()
const listeners = new Set<() => void>()

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function registerCommand(cmd: Command): () => void {
  commands.set(cmd.id, cmd)
  listeners.forEach((l) => l())
  return () => {
    if (commands.get(cmd.id) === cmd) commands.delete(cmd.id)
    listeners.forEach((l) => l())
  }
}

export const listCommands = () => [...commands.values()].filter((c) => !c.when || c.when())
export const getCommand = (id: string) => commands.get(id)

export function runCommand(id: string) {
  const c = commands.get(id)
  if (c) return c.run()
}

export function formatHotkey(h: string) {
  return h
    .split('+')
    .map((k) => (k === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : k === 'Shift' ? (isMac ? '⇧' : 'Shift') : k === 'Alt' ? (isMac ? '⌥' : 'Alt') : k))
    .join(isMac ? '' : '+')
}

export function matchesHotkey(e: KeyboardEvent, h: string): boolean {
  const parts = h.split('+')
  const key = parts.pop()!.toLowerCase()
  const want = { mod: parts.includes('Mod'), shift: parts.includes('Shift'), alt: parts.includes('Alt') }
  const mod = isMac ? e.metaKey : e.ctrlKey
  if (mod !== want.mod || e.shiftKey !== want.shift || e.altKey !== want.alt) return false
  // e.code keeps Alt+letter working on macOS where Alt changes e.key.
  const code = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code.startsWith('Digit') ? e.code.slice(5) : null
  const k = e.key.toLowerCase()
  return k === key || code === key || (key === '\\' && e.code === 'Backslash')
}

export function commandForEvent(e: KeyboardEvent): Command | undefined {
  for (const c of commands.values()) if (c.hotkey && matchesHotkey(e, c.hotkey) && (!c.when || c.when())) return c
  return undefined
}

export const onCommandsChanged = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}
