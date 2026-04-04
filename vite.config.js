import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync } from 'fs'

const copyStockfish = {
  name: 'copy-stockfish',
  buildStart() {
    const base = './node_modules/stockfish/src/'
    const dest = './public/'
    const files = ['stockfish-nnue-16-single.js', 'stockfish-nnue-16-single.wasm']
    for (const f of files) {
      if (existsSync(base + f)) copyFileSync(base + f, dest + f)
    }
  },
}

export default defineConfig({
  plugins: [
    copyStockfish,
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
      },
    }),
  ],
  base: '/YACPA/',
})
