import { useEffect } from 'react'
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Toaster } from 'sonner'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import TanStackQueryDevtools from '#/integrations/tanstack-query/devtools'
import { OfflineBanner } from '#/components/OfflineBanner'
import { RouteStatus } from '#/components/RouteStatus'
import { getSessionFn } from '#/server/auth'
import { authClient } from '#/lib/auth-client'
import { clearOfflineCache } from '#/lib/offline-cache'
import { prefetchProfileData } from '#/lib/prefetch-profile-data'

import appCss from '#/styles.css?url'

import type { RootRouterContext } from '#/integrations/tanstack-query/root-provider'

export const Route = createRootRouteWithContext<RootRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { name: 'theme-color', content: '#0b1326' },
      {
        name: 'description',
        content:
          'Phinio — track investments and manage EMIs in one unified dashboard.',
      },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      { name: 'apple-mobile-web-app-title', content: 'Phinio' },
      { title: 'Phinio — Your finances, simplified.' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  shellComponent: RootDocument,
  errorComponent: ({ reset }) => (
    <RouteStatus
      icon="error"
      title="Something went wrong"
      description="An unexpected error occurred. Try again, or head back home."
      action={{ label: 'Try again', onClick: reset }}
      secondaryAction={{ label: 'Back to home', to: '/' }}
    />
  ),
  notFoundComponent: () => (
    <RouteStatus
      icon="not-found"
      title="Page not found"
      description="We couldn't find the page you were looking for."
      action={{ label: 'Back to home', to: '/' }}
    />
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { persisterReady } = Route.useRouteContext()
  // Subscribe to client-side auth state so we can replay queued mutations
  // when the user signs back in WITHOUT a network round-trip (e.g. token
  // refresh, login while already online). The effect below depends on this.
  const { data: clientSession } = authClient.useSession()
  const isAuthenticated = Boolean(clientSession?.user.id)

  // Register the Workbox service worker on first client mount.
  // Production-only: dev has devOptions.enabled = false in vite.config.ts,
  // but we guard here too so HMR never touches service worker state.
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('[sw] registration failed', err))
    }
  }, [])

  // Replay any paused mutations once the network returns. We verify the
  // Better Auth session first — a queued mutation that hits a 401 fails
  // silently and the user has no idea their edit didn't save. If the
  // session check throws (still offline), we leave the queue alone and
  // wait for the next online event. Also runs once on mount in case the
  // page was reloaded with mutations still paused in IndexedDB.
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    async function flush() {
      // Wait for IndexedDB restore so cachedSession (cross-account check)
      // and resumePausedMutations both see the persisted state, not an
      // empty cache that races them.
      await persisterReady
      if (cancelled) return
      if (!navigator.onLine) return
      let session: Awaited<ReturnType<typeof getSessionFn>>
      try {
        session = await getSessionFn()
      } catch (err) {
        // Distinguish "still offline / fetch failed" from "server returned
        // an error". On a TypeError / NetworkError we wait for the next
        // online event; on any other failure (5xx, parse error) we log so
        // it's not silent — but still bail rather than risk replaying into
        // an unverified session.
        const isTransport =
          err instanceof TypeError ||
          (err instanceof Error &&
            (err.message.includes('Failed to fetch') ||
              err.message.includes('NetworkError') ||
              err.message.includes('Load failed')))
        if (!isTransport) {
          console.warn('[phinio] session check failed unexpectedly', err)
        }
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cancelled) return // cancelled may flip while getSessionFn() awaits

      // Cross-account safety: if a different user is now signed in than
      // the one whose data is in the persisted cache, wipe everything
      // before flushing. Otherwise the previous user's queued mutations
      // would replay into the new user's account, and stale list data
      // would surface until the first refetch lands.
      const cachedSession = queryClient.getQueryData<{
        user?: { id?: string }
      }>(['auth', 'session'])
      const cachedUserId = cachedSession?.user?.id
      const currentUserId = session ? session.user.id : undefined
      if (cachedUserId && currentUserId && cachedUserId !== currentUserId) {
        await clearOfflineCache(queryClient)
        return
      }

      if (!session) return
      try {
        await queryClient.resumePausedMutations()
        await queryClient.invalidateQueries()
      } catch (err) {
        console.warn('[phinio] replay failed', err)
      }
      // Warm IndexedDB with every screen's data so a subsequent cold launch
      // offline shows real numbers, not empty states. Fire-and-forget — the
      // helper guards each prefetch and respects staleTime so this is cheap
      // when the cache is already fresh.
      void prefetchProfileData(queryClient).catch(() => {
        // Already swallowed inside the helper, but belt-and-braces.
      })
    }

    void flush()
    window.addEventListener('online', flush)
    return () => {
      cancelled = true
      window.removeEventListener('online', flush)
    }
    // `isAuthenticated` is in deps so signing in while online (no `online`
    // event fires) still replays the queue. `persisterReady` is stable per
    // QueryClient instance, so it doesn't actually re-trigger this effect.
  }, [queryClient, isAuthenticated, persisterReady])

  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-surface text-on-surface font-sans antialiased">
        <OfflineBanner />
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          offset="calc(env(safe-area-inset-top) + 16px)"
          mobileOffset="calc(env(safe-area-inset-top) + 16px)"
          toastOptions={{
            style: {
              background: '#171f33',
              border: '1px solid rgba(141, 144, 160, 0.14)',
              color: '#dae2fd',
              borderRadius: '16px',
            },
          }}
        />
        {process.env.NODE_ENV !== 'production' && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        )}
        <Analytics />
        <SpeedInsights />
        <Scripts />
      </body>
    </html>
  )
}
