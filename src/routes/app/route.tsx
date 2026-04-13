import {
  Outlet,
  createFileRoute,
  redirect,
} from '@tanstack/react-router'
import { getSessionFn } from '#/server/auth'

export const Route = createFileRoute('/app')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { user: session.user }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="min-h-dvh bg-surface text-on-surface">
      <Outlet />
    </div>
  )
}
