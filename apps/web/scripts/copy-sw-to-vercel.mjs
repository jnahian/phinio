// vite-plugin-pwa (injectManifest) writes the service worker to
// `dist/sw.js`, but Nitro's Vercel preset serves static assets from
// `.vercel/output/static/`. Without this copy step `/sw.js` 404s in
// production, so no service worker ever activates — breaking Web Push
// and offline caching entirely.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const src = 'dist/sw.js'
const dst = '.vercel/output/static/sw.js'

if (!existsSync(src)) {
  console.error(`[copy-sw] source not found: ${src}`)
  process.exit(1)
}
if (!existsSync(dirname(dst))) {
  console.error(`[copy-sw] Vercel static dir not found: ${dirname(dst)}`)
  process.exit(1)
}

copyFileSync(src, dst)
console.log(`[copy-sw] ${src} → ${dst}`)
