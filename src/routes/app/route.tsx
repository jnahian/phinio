import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
} from '@tanstack/react-router'
import { BottomTabBar } from '#/components/BottomTabBar'
import { TopBar } from '#/components/TopBar'
import { getSessionFn, getShellUserFn } from '#/server/auth'
import { getProfileFn } from '#/server/profile'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    const [profile, shellUser] = await Promise.all([
      getProfileFn(),
      getShellUserFn(),
    ])
    return { user: session.user, profile, shellUser }
  },
  component: AppLayout,
})

function AppLayout() {
  const { shellUser, profile } = Route.useRouteContext()
  const matches = useMatches()
  const hideTabBar = matches.some(
    (m) => (m.staticData as { hideTabBar?: boolean } | undefined)?.hideTabBar,
  )

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <div className="mx-auto w-full max-w-md">
        {shellUser && (
          <TopBar userName={profile.fullName} avatarUrl={shellUser.avatarUrl} />
        )}
        <Outlet />
      </div>
      {!hideTabBar && <BottomTabBar />}
    </div>
  )
}
