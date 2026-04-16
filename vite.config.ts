import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { VitePWA } from 'vite-plugin-pwa'

const config = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: 'vercel' }),
    viteReact(),
    VitePWA({
      // We register the service worker manually (see __root.tsx) so the plugin
      // doesn't inject a script tag that can conflict with SSR hydration.
      registerType: 'autoUpdate',
      injectRegister: null,

      workbox: {
        // ── SSR safety ─────────────────────────────────────────────────────
        // Never use a navigation fallback. Every page request must reach the
        // Nitro server so SSR renders the correct HTML. Without this a cached
        // shell would be returned for all routes, breaking server-rendering.
        navigateFallback: null,

        // Only precache hashed static assets — never HTML files.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2,webp}'],

        // ── Runtime caching strategies ──────────────────────────────────────
        runtimeCaching: [
          // JS / CSS — content-hashed by Vite, safe to serve from cache
          {
            urlPattern: ({ request }) =>
              request.destination === 'script' ||
              request.destination === 'style',
            handler: 'CacheFirst',
            options: {
              cacheName: 'phinio-static-v1',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          // Images / icons
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'phinio-images-v1',
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          // Google Fonts CSS (changes rarely, revalidate in background)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          // Google Fonts woff2 files (immutable, cache for a year)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // We manage our own site.webmanifest — don't generate a second one.
      manifest: false,

      // Keep the service worker out of development to avoid confusing
      // cache behaviour when iterating on code.
      devOptions: { enabled: false },
    }),
  ],
})

export default config
