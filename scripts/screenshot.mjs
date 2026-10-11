// Captures docs/screenshot-*.png from the demo vault. Run with the dev server on :5173.
import { chromium } from '@playwright/test'

const browser = await chromium.launch()
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2, colorScheme: theme })
  await page.addInitScript((t) => localStorage.setItem('mycel.theme', t), theme)
  await page.goto('http://localhost:5173/')
  await page.getByTestId('demo-button').click()
  await page.keyboard.press('Control+o')
  await page.getByPlaceholder('Find or create a note…').fill('Atlas Migration')
  await page.keyboard.press('Enter')
  await page.getByRole('treeitem', { name: 'Coffee' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `docs/screenshot-${theme}.png` })
  await page.close()
}
await browser.close()
