import { router } from './trpc.js'
import { activityRouter } from './routers/activity.js'
import { dashboardRouter } from './routers/dashboard.js'
import { emisRouter } from './routers/emis.js'
import { investmentsRouter } from './routers/investments.js'
import { notificationsRouter } from './routers/notifications.js'
import { profileRouter } from './routers/profile.js'
import { pushRouter } from './routers/push.js'

/**
 * Domains land here as we port. Phase 2A landed `emis`; Phase 2B added
 * `investments`; Phase 2C added `activity`; Phase 2D added `notifications`;
 * Phase 2E added `profile`; Phase 2F added `push`; Phase 4A adds `dashboard`
 * (read-only stats).
 */
export const appRouter = router({
  activity: activityRouter,
  dashboard: dashboardRouter,
  emis: emisRouter,
  investments: investmentsRouter,
  notifications: notificationsRouter,
  profile: profileRouter,
  push: pushRouter,
})

export type AppRouter = typeof appRouter
