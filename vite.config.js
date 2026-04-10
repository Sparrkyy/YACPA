import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, existsSync, writeFileSync } from 'fs'

const WASM_CDN = 'https://unpkg.com/stockfish@18.0.7/bin/stockfish-18-lite-single.wasm'

const copyStockfish = {
  name: 'copy-stockfish',
  async buildStart() {
    const base = './node_modules/stockfish/bin/'
    const dest = './public/'
    // Copy the JS loader (~20KB)
    const files = ['stockfish-18-lite-single.js']
    for (const f of files) {
      if (existsSync(base + f)) copyFileSync(base + f, dest + f)
    }
    // Download WASM from CDN if not already present (~7MB, not committed to git)
    const wasmDest = dest + 'stockfish-18-lite-single.wasm'
    if (!existsSync(wasmDest)) {
      console.log('[stockfish] Downloading WASM from CDN...')
      const res = await fetch(WASM_CDN)
      if (!res.ok) throw new Error(`Failed to fetch WASM: ${res.status}`)
      writeFileSync(wasmDest, Buffer.from(await res.arrayBuffer()))
      console.log('[stockfish] WASM downloaded.')
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
        // WASM is 7.3MB — raise the default 2MB precache limit
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  base: '/YACPA/',
})
