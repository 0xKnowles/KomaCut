import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyPdfJsWasmAssets } from './scripts/pdfjs-wasm'

const projectRoot = import.meta.dirname

// GitHub Pages serves a project site from /<repo>/, so every asset URL needs
// that prefix. Override with BASE_PATH=/ when deploying to a user site or to
// any host that serves from the root.
const base = process.env.BASE_PATH ?? '/KomaCut/'

export default defineConfig({
  base,
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    {
      name: 'pdfjs-wasm-assets',
      async writeBundle(options) {
        await copyPdfJsWasmAssets(
          resolve(projectRoot, 'node_modules/pdfjs-dist/wasm'),
          resolve(projectRoot, options.dir ?? 'dist', 'pdfjs/wasm'),
        )
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'KomaCut - CBZ & PDF to XTC Converter for KomaOS',
        short_name: 'KomaCut',
        description:
          'Convert CBZ/CBR comics and PDFs to XTC for KomaOS on the XTEink X4, entirely in your browser.',
        theme_color: '#fafafa',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        // A volume's worth of XTC output dwarfs the default 2MB cap, and the
        // pdf.js wasm bundles alone exceed it.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
})
