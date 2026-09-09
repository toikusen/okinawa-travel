import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Event photos live in Supabase Storage, so the precache never sees
        // them and an offline timeline showed broken thumbnails. Cache-first:
        // an uploaded image is immutable at its URL (upsert rewrites the same
        // path only when the user replaces it).
        runtimeCaching: [
          {
            urlPattern: /\/storage\/v1\/object\/public\/event-images\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'event-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Tabi',
        short_name: 'Tabi',
        theme_color: '#0077b6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 4200,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/.claude/**', '**/node_modules/**'],
  },
})
