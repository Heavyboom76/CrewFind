import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  publicDir: 'public',
  build: {
    outDir: '../www',
    emptyOutDir: true,
  },
  server: {
    open: true,
  }
})
