import { useCallback, useState } from 'react'
import {
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
} from '@tanstack/react-router'
import { BottomTabBar } from '#/components/BottomTabBar'
import { TopBar } from '#/components/TopBar'
import { TopBarTitleContext } from '#/lib/top-bar-context'
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
      </div>
    </TopBarTitleContext.Provider>
  )
}
