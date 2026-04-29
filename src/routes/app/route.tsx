import { useCallback, useState } from 'react'
import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
} from '@tanstack/react-router'
import { CalendarClock, PiggyBank, TrendingUp, Wallet } from 'lucide-react'
import { BottomTabBar } from '#/components/BottomTabBar'
import { FABMenu } from '#/components/ui/FABMenu'
import { TopBar } from '#/components/TopBar'
import { TopBarTitleContext } from '#/lib/top-bar-context'
import { getSessionFn, getShellUserFn } from '#/server/auth'
import type { ShellUser } from '#/server/auth'
import { getProfileFn } from '#/server/profile'

// Cache the auth-shell triple via TanStack Query so the persister snapshots
// them to IndexedDB. When the user is offline, the network calls below throw,
// and we fall back to the last-known cached values to keep the route mounted
// instead of redirecting to /login. If there's no cached session at all, we
// still redirect — the user genuinely needs to authenticate.
const SESSION_KEY = ['auth', 'session'] as const
const PROFILE_KEY = ['auth', 'profile'] as const
const SHELL_USER_KEY = ['auth', 'shell-user'] as const

type SessionData = Awaited<ReturnType<typeof getSessionFn>>
type ProfileData = Awaited<ReturnType<typeof getProfileFn>>

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context }) => {
    const { queryClient } = context

    try {
      const session = await queryClient.fetchQuery({
        queryKey: SESSION_KEY,
        queryFn: () => getSessionFn(),
        staleTime: 5 * 60_000,
      })
      if (!session) {
        throw redirect({ to: '/login' })
      }
      const [profile, shellUser] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: PROFILE_KEY,
          queryFn: () => getProfileFn(),
          staleTime: 5 * 60_000,
        }),
        queryClient.fetchQuery({
          queryKey: SHELL_USER_KEY,
          queryFn: () => getShellUserFn(),
          staleTime: 5 * 60_000,
        }),
      ])
      return { user: session.user, profile, shellUser }
    } catch (err) {
      // Re-throw redirects from the success path untouched.
      if (err && typeof err === 'object' && 'isRedirect' in err) throw err

      // Only fall back to cached identity for genuine offline / transport
      // failures. A backend 500 should NOT keep /app mounted on stale
      // cached data — that masks real outages. Heuristic: if we're
      // definitely offline OR the error looks like a fetch transport
      // failure (no HTTP status), serve cached. Anything that reached the
      // server and came back with a status code bubbles up to the route's
      // errorComponent.
      const isOffline =
        typeof navigator !== 'undefined' && navigator.onLine === false
      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes('Failed to fetch') ||
            err.message.includes('NetworkError') ||
            err.message.includes('Load failed')))
      if (!isOffline && !isNetworkError) throw err

      const cachedSession = queryClient.getQueryData<SessionData>(SESSION_KEY)
      const cachedProfile = queryClient.getQueryData<ProfileData>(PROFILE_KEY)
      const cachedShellUser = queryClient.getQueryData<ShellUser | null>(
        SHELL_USER_KEY,
      )
      if (cachedSession && cachedProfile) {
        return {
          user: cachedSession.user,
          profile: cachedProfile,
          shellUser: cachedShellUser ?? null,
        }
      }

      // No cached identity — bounce to login so they can authenticate when
      // the network is back.
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

interface RouteStaticData {
  hideTabBar?: boolean
  title?: string
  backTo?: string
}

function AppLayout() {
  const { shellUser, profile } = Route.useRouteContext()
  const matches = useMatches()

  const deepest = matches[matches.length - 1] as
    | { staticData?: RouteStaticData }
    | undefined
  const staticData = deepest?.staticData ?? {}

  const hideTabBar = staticData.hideTabBar
  const staticTitle = staticData.title ?? null
  const backTo = staticData.backTo ?? null

  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null)
  const setTitle = useCallback((t: string | null) => setDynamicTitle(t), [])

  return (
    <TopBarTitleContext.Provider value={{ title: dynamicTitle, setTitle }}>
      <div className="min-h-dvh bg-surface text-on-surface">
        <div className="mx-auto w-full max-w-xl">
          {shellUser && (
            <TopBar
              title={dynamicTitle ?? staticTitle}
              backTo={backTo}
              userName={profile.fullName}
              avatarUrl={shellUser.avatarUrl}
            />
          )}
          <Outlet />
        </div>
        {!hideTabBar && <BottomTabBar />}
        {!hideTabBar && (
          <FABMenu
            label="Create"
            items={[
              {
                to: '/app/investments/new',
                label: 'Investment',
                icon: <TrendingUp className="h-5 w-5" strokeWidth={1.75} />,
              },
              {
                to: '/app/investments/dps/new',
                label: 'DPS Scheme',
                icon: <PiggyBank className="h-5 w-5" strokeWidth={1.75} />,
              },
              {
                to: '/app/investments/savings/new',
                label: 'Savings Pot',
                icon: <Wallet className="h-5 w-5" strokeWidth={1.75} />,
              },
              {
                to: '/app/emis/new',
                label: 'EMI',
                icon: <CalendarClock className="h-5 w-5" strokeWidth={1.75} />,
              },
            ]}
          />
        )}
      </div>
    </TopBarTitleContext.Provider>
  )
}
