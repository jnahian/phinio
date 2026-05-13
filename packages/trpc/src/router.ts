import { router } from './trpc.js'
import { activityRouter } from './routers/activity.js'
import { emisRouter } from './routers/emis.js'
import { investmentsRouter } from './routers/investments.js'
import { profileRouter } from './routers/profile.js'

/**
 * Domains land here as we port. Phase 2A landed `emis`; Phase 2B added
 * `investments`; Phase 2C added `activity`; Phase 2E adds `profile`.
 * Subsequent Phase 2 plans add deposits, notifications, push.
 */
export const appRouter = router({
  activity: activityRouter,
  emis: emisRouter,
  investments: investmentsRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
