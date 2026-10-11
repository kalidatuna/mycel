import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true },
})
