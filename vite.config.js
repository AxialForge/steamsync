import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Renderer-only Vite build. The Electron main process is plain CommonJS and is
// NOT bundled — it is shipped from src/main as-is (matching the JDot layout).
// Renderer output goes to dist/renderer; electron-builder packages that folder.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './', // so the built index.html loads assets via file:// in the packaged app
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    target: 'chrome128'
  }
})
