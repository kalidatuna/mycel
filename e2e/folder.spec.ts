import { expect, test, type Page } from '@playwright/test'
import { cursorToEnd, editor, openNote } from './helpers'

/**
 * Exercises the real File System Access code path using the Origin Private File System,
 * which hands out the same FileSystemDirectoryHandle API as a user-picked folder.
 */
async function seedAndOpen(page: Page, files: Record<string, string>) {
  await page.goto('/')
  await page.waitForFunction(() => 'openHandle' in ((window as unknown as { __mycel?: object }).__mycel ?? {}))
  await page.evaluate(async (files) => {
    const root = await navigator.storage.getDirectory()
    for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) await root.removeEntry(name, { recursive: true })
    const vault = await root.getDirectoryHandle('vault', { create: true })
    for (const [path, text] of Object.entries(files)) {
      const parts = path.split('/')
      let dir = vault
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true })
      const w = await (await dir.getFileHandle(parts.at(-1)!, { create: true })).createWritable()
      await w.write(text)
      await w.close()
    }
    await (window as unknown as { __mycel: { openHandle(h: FileSystemDirectoryHandle): Promise<void> } }).__mycel.openHandle(vault)
  }, files)
  await expect(page.getByRole('tree', { name: 'Notes' })).toBeVisible()
}

const opfsRead = (page: Page, path: string) =>
  page.evaluate(async (path) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('vault')
    const parts = path.split('/')
    try {
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p)
      return await (await (await dir.getFileHandle(parts.at(-1)!)).getFile()).text()
    } catch {
      return null
    }
  }, path)

const opfsWrite = (page: Page, path: string, text: string) =>
  page.evaluate(
    async ([path, text]) => {
      const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('vault')
      const w = await (await dir.getFileHandle(path!, { create: true })).createWritable()
      await w.write(text!)
      await w.close()
    },
    [path, text],
  )

test('real folder: edit, rename with link rewrite, trash, external change', async ({ page }) => {
  await seedAndOpen(page, {
    'Home.md': '---\nkeep: "exact  spacing"   # comment\n---\n# Home\nSee [[Ideas]] and [[Ideas|my ideas]].\n',
    'notes/Ideas.md': '# Ideas\n- first\n',
    'Other.md': 'Nothing to change here.\n',
    'image.png': 'not really a png',
  })
  await expect(page.locator('.statusbar')).toContainText('3 notes')

  // Edit + autosave writes through createWritable.
  await openNote(page, 'Ideas')
  await cursorToEnd(page)
  await page.keyboard.type('- second')
  await expect.poll(() => opfsRead(page, 'notes/Ideas.md')).toBe('# Ideas\n- first\n- second')

  // Rename rewrites links, keeps frontmatter exactly, leaves unrelated files alone.
  await page.keyboard.press('F2')
  await page.getByRole('textbox', { name: 'Rename note' }).fill('Big Ideas')
  await page.keyboard.press('Enter')
  await expect.poll(() => opfsRead(page, 'Home.md')).toBe('---\nkeep: "exact  spacing"   # comment\n---\n# Home\nSee [[Big Ideas]] and [[Big Ideas|my ideas]].\n')
  expect(await opfsRead(page, 'notes/Ideas.md')).toBeNull()
  expect(await opfsRead(page, 'notes/Big Ideas.md')).toBe('# Ideas\n- first\n- second')
  expect(await opfsRead(page, 'Other.md')).toBe('Nothing to change here.\n')

  // Trash moves into .trash.
  await page.keyboard.press('Control+p')
  await page.getByPlaceholder('Type a command…').fill('move current note to trash')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await expect.poll(() => opfsRead(page, '.trash/notes/Big Ideas.md')).toBe('# Ideas\n- first\n- second')

  // A file written by another program shows up via the watcher.
  await opfsWrite(page, 'From Outside.md', '# From Outside\nLinks [[Home]].\n')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('treeitem', { name: 'From Outside' })).toBeVisible({ timeout: 8000 })

  // An external edit to the open note reloads it when there are no local edits.
  await openNote(page, 'Home')
  await opfsWrite(page, 'Home.md', '# Home\nRewritten elsewhere.\n')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(editor(page)).toContainText('Rewritten elsewhere.', { timeout: 8000 })
})
