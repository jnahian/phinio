import { router } from './trpc.js'
import { activityRouter } from './routers/activity.js'
import { emisRouter } from './routers/emis.js'
import { investmentsRouter } from './routers/investments.js'
import { pushRouter } from './routers/push.js'

/**
 * Domains land here as we port. Phase 2A landed `emis`; Phase 2B added
 * `investments`; Phase 2C adds `activity`; Phase 2F adds `push`.
 * Subsequent Phase 2 plans add deposits, notifications, profile.
 */
export const appRouter = router({
  activity: activityRouter,
  emis: emisRouter,
  investments: investmentsRouter,
  push: pushRouter,
})

export type AppRouter = typeof appRouter
