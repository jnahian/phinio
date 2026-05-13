import { router } from './trpc.js'
import { activityRouter } from './routers/activity.js'
import { emisRouter } from './routers/emis.js'
import { investmentsRouter } from './routers/investments.js'

/**
 * Domains land here as we port. Phase 2A landed `emis`; Phase 2B added
 * `investments`; Phase 2C adds `activity`. Subsequent Phase 2 plans add
 * deposits, notifications, profile, push.
 */
export const appRouter = router({
  activity: activityRouter,
  emis: emisRouter,
  investments: investmentsRouter,
})

export type AppRouter = typeof appRouter
