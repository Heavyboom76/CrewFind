import { defineConfig } from 'vite'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'src/public'),
  build: {
    outDir: '../www',
    emptyOutDir: false,
  },
  server: {
    open: true,
  }
})
