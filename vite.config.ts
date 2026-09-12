import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  // GitHub Pages serves this project below /ladmo-seal-codex/.
  base: '/ladmo-seal-codex/',
  plugins: [react()],
})
