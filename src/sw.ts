/// <reference lib="webworker" />
// This file is compiled by vite-plugin-pwa (injectManifest) into /sw.js.
// The Workbox precache manifest is injected where `self.__WB_MANIFEST`
// appears below.

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>
}

// ── Precache (hashed build assets) ──────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)

// ── Runtime caching ─────────────────────────────────────────────────────────
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new CacheFirst({
    cacheName: 'phinio-static-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'phinio-images-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  }),
)

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 7 }),
    ],
  }),
)

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  }),
)

// ── Push ───────────────────────────────────────────────────────────────────

interface PushPayload {
  title: string
  body: string
  link?: string | null
  dedupeKey?: string
  notificationId?: string
}

self.addEventListener('push', (event) => {
  let payload: PushPayload | null = null
  try {
    payload = event.data ? (event.data.json() as PushPayload) : null
  } catch {
    payload = null
  }
  if (!payload || !payload.title) return

  const options: NotificationOptions = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      link: payload.link ?? '/app',
      notificationId: payload.notificationId ?? null,
    },
    tag: payload.dedupeKey,
  }
  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as
    | { link?: string | null; notificationId?: string | null }
    | undefined
  const targetUrl = data?.link ?? '/app'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl)
            } catch {
              // Cross-origin or detached — ignore.
            }
          }
          return
        }
      }
      await self.clients.openWindow(targetUrl)
    })(),
  )
})

self.addEventListener('pushsubscriptionchange', (event: Event) => {
  // Fires when the browser rotates the subscription (Chromium). We can't
  // re-subscribe without the VAPID public key here; the client will detect
  // the change on next page load and re-subscribe via usePushSubscription.
  const e = event as Event & { waitUntil: (p: Promise<unknown>) => void }
  e.waitUntil(Promise.resolve())
})
