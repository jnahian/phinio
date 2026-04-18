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

      // injectManifest: we own the service worker source at src/sw.ts so we
      // can add push + notificationclick handlers alongside Workbox precache.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',

      injectManifest: {
        // Only precache hashed static assets — never HTML files.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2,webp}'],
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
