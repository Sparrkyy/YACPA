import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync } from 'fs'

const copyStockfish = {
  name: 'copy-stockfish',
  buildStart() {
    const base = './node_modules/stockfish/bin/'
    const dest = './public/'
    const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm']
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
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Chess Puzzle Trainer',
        short_name: 'Chess Puzzles',
        description: 'Turn your Chess.com mistakes into spaced-repetition puzzles',
        start_url: '/YACPA/',
        scope: '/YACPA/',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB — covers SF18 lite WASM (7MB)
      },
    }),
  ],
  base: '/YACPA/',
})
