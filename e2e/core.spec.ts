import { expect, test } from '@playwright/test'
import { cursorToEnd, editor, fileExists, openDemo, openNote, readFile } from './helpers'

test.beforeEach(async ({ page }) => openDemo(page))

test('start screen opens the demo vault with tree, editor and panels', async ({ page }) => {
  await expect(page.getByRole('treeitem', { name: 'Coffee' })).toBeVisible()
  await openNote(page, 'Atlas Migration')
  await expect(editor(page)).toContainText('pull billing and invoicing')
  await expect(page.getByRole('button', { name: /Backlinks/ })).toContainText('6')
})

test('edits autosave to the file', async ({ page }) => {
  await openNote(page, 'Gift Ideas')
  await cursorToEnd(page)
  await page.keyboard.type('\n- Dad: a new pocket notebook')
  await expect(page.locator('.statusbar')).toContainText('Saved')
  await expect.poll(() => readFile(page, 'Gift Ideas.md')).toContain('- Dad: a new pocket notebook')
  // Frontmatter is preserved byte-for-byte.
  expect(await readFile(page, 'Gift Ideas.md')).toMatch(/^---\ncreated: 2026-03-28\ntags: \[personal\]\n---\n/)
})

test('clicking a rendered wikilink follows it', async ({ page }) => {
  await openNote(page, 'Coffee')
  await editor(page).locator('.cm-wikilink', { hasText: 'V60 Technique' }).click()
  await expect(page.getByRole('tab', { name: 'V60 Technique', selected: true })).toBeVisible()
  await expect(editor(page)).toContainText('1:13')
})

test('clicking a broken link creates the note', async ({ page }) => {
  await openNote(page, 'Inbox')
  const broken = editor(page).locator('.cm-wikilink-broken', { hasText: 'Mechanical Keyboards' })
  await expect(broken).toBeVisible()
  await broken.click()
  await expect(page.getByRole('tab', { name: 'Mechanical Keyboards', selected: true })).toBeVisible()
  expect(await fileExists(page, 'Mechanical Keyboards.md')).toBe(true)
})

test('wikilink autocomplete inserts a link', async ({ page }) => {
  await openNote(page, 'Quotes I Like')
  await cursorToEnd(page)
  await page.keyboard.type('\nSee [[V60 Tec')
  await expect(page.locator('.cm-tooltip-autocomplete')).toContainText('V60 Technique')
  await page.waitForTimeout(150) // CodeMirror ignores Enter for 75 ms after the list opens
  await page.keyboard.press('Enter')
  await page.keyboard.type(' later')
  await expect.poll(() => readFile(page, 'Quotes I Like.md')).toContain('See [[V60 Technique]] later')
})

test('renaming a note rewrites links across the vault', async ({ page }) => {
  await openNote(page, 'Brew Ratios')
  await page.keyboard.press('F2')
  const input = page.getByRole('textbox', { name: 'Rename note' })
  await input.fill('Coffee Ratios')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: 'Coffee Ratios', selected: true })).toBeVisible()
  await expect.poll(() => readFile(page, 'Coffee/Coffee.md')).toContain('- [[Coffee Ratios]]')
  expect(await fileExists(page, 'Coffee/Brew Ratios.md')).toBe(false)
  await expect(page.getByRole('button', { name: /Backlinks/ })).toContainText('1')
})

test('global search shows highlighted snippets', async ({ page }) => {
  await page.keyboard.press('Control+Shift+F')
  await page.getByRole('searchbox', { name: 'Search all notes' }).fill('stampede')
  const first = page.locator('.search-results .result').first()
  await expect(first).toContainText('Incident 2026-05-19 Cache Stampede')
  await expect(first.locator('mark').first()).toHaveText(/stampede/i)
  await first.click()
  await expect(page.getByRole('tab', { name: /Cache Stampede/, selected: true })).toBeVisible()
})

test('command palette runs commands', async ({ page }) => {
  const before = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.keyboard.press('Control+p')
  await page.getByPlaceholder('Type a command…').fill('toggle theme')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(before)
})

test('unlinked mention can be linked in one click', async ({ page }) => {
  await openNote(page, 'Zone 2 Training')
  const mention = page.locator('.mention').filter({ hasText: '2026-03-19' })
  await expect(mention).toBeVisible()
  await mention.getByRole('button', { name: /Link this mention/ }).click()
  await expect.poll(() => readFile(page, 'Daily/2026-03-19.md')).toContain('[[Zone 2 Training]] feels absurdly slow')
  await expect(page.getByRole('button', { name: /Backlinks/ })).toContainText('3')
})

test('tag browser filters search by tag', async ({ page }) => {
  await page.getByRole('button', { name: 'Tags' }).click()
  await page.getByRole('button', { name: '#sourdough' }).click()
  await expect(page.getByRole('searchbox', { name: 'Search all notes' })).toHaveValue('tag:sourdough')
  await expect(page.locator('.search-results .result')).toHaveCount(5)
})

test('move to trash keeps the file in .trash', async ({ page }) => {
  await page.getByRole('treeitem', { name: 'Bike Tune-up Checklist' }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Move to trash' }).click()
  await page.getByRole('button', { name: 'Move to trash' }).click()
  await expect(page.getByRole('treeitem', { name: 'Bike Tune-up Checklist' })).toHaveCount(0)
  expect(await readFile(page, '.trash/Bike Tune-up Checklist.md')).toContain('Tyre pressure')
})

test('split panes and daily note', async ({ page }) => {
  await openNote(page, 'Coffee')
  await page.keyboard.press('Control+\\')
  await expect(page.locator('.pane')).toHaveCount(2)
  await page.keyboard.press('Alt+d')
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  await expect(page.locator('.pane').nth(1).getByRole('tab', { name: iso, selected: true })).toBeVisible()
  await expect(page.locator('.pane').nth(0).getByRole('tab', { name: 'Coffee', selected: true })).toBeVisible()
  expect(await readFile(page, `Daily/${iso}.md`)).toContain(`# ${iso}`)
})

test('file tree supports keyboard navigation', async ({ page }) => {
  const first = page.getByRole('treeitem', { name: 'Baking' })
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(first).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { name: 'Bake Log', selected: true })).toBeVisible()
})
