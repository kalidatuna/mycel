import { expect, type Page } from '@playwright/test'

export async function openDemo(page: Page) {
  await page.goto('/')
  await page.getByTestId('demo-button').click()
  await expect(page.getByRole('tree', { name: 'Notes' })).toBeVisible()
}

export async function openNote(page: Page, query: string) {
  await page.keyboard.press('Control+o')
  await page.getByPlaceholder('Find or create a note…').fill(query)
  await page.keyboard.press('Enter')
}

export const editor = (page: Page) => page.locator('.pane').first().locator('.cm-content')

export async function readFile(page: Page, path: string): Promise<string | undefined> {
  return page.evaluate((p) => (window as unknown as { __mycel: { read(p: string): Promise<string> } }).__mycel.read(p), path)
}

export async function fileExists(page: Page, path: string): Promise<boolean> {
  return page.evaluate((p) => (window as unknown as { __mycel: { exists(p: string): Promise<boolean> } }).__mycel.exists(p), path)
}

/** Put the cursor at the end of the document. */
export async function cursorToEnd(page: Page) {
  await editor(page).click()
  await page.keyboard.press('Control+End')
}
