import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
} from '@tanstack/react-router'
import { BottomTabBar } from '#/components/BottomTabBar'
import { getSessionFn } from '#/server/auth'
import { getProfileFn } from '#/server/profile'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    const profile = await getProfileFn()
    return { user: session.user, profile }
  },
  component: AppLayout,
})

function AppLayout() {
  const matches = useMatches()
  const hideTabBar = matches.some(
    (m) => (m.staticData as { hideTabBar?: boolean } | undefined)?.hideTabBar,
  )

  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <Outlet />
      {!hideTabBar && <BottomTabBar />}
    </div>
  )
}
