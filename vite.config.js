import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync } from 'fs'

const copyStockfish = {
  name: 'copy-stockfish',
  buildStart() {
    const base = './node_modules/stockfish/bin/'
    const dest = './public/'
    // Only copy the JS loader (~20KB). WASM (~7MB) is fetched from CDN at runtime.
    const files = ['stockfish-18-lite-single.js']
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
        runtimeCaching: [
          {
            // Cache the CDN-hosted WASM so the engine works offline after first load
            urlPattern: /unpkg\.com\/stockfish/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'stockfish-wasm',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  base: '/YACPA/',
})
