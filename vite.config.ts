import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { demoVault } from './vite-plugin-demo-vault.ts'

export default defineConfig({
  plugins: [react(), demoVault('demo-vault', 'scripts/demo-dates.json')],
  worker: { format: 'es' },
  // CodeMirror + React make the editor chunk ~550 kB (190 kB gzipped); it loads after a vault opens.
  build: { chunkSizeWarningLimit: 650 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
