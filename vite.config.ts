import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { demoVault } from './vite-plugin-demo-vault'

export default defineConfig({
  plugins: [react(), demoVault('demo-vault', 'scripts/demo-dates.json')],
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
