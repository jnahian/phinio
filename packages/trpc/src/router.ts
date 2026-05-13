import { router } from './trpc.js'
import { emisRouter } from './routers/emis.js'
import { investmentsRouter } from './routers/investments.js'

/**
 * Domains land here as we port. Phase 2A landed `emis`; Phase 2B adds
 * `investments`. Subsequent Phase 2 plans add deposits, activity,
 * notifications, profile, push.
 */
export const appRouter = router({
  emis: emisRouter,
  investments: investmentsRouter,
})

export type AppRouter = typeof appRouter
