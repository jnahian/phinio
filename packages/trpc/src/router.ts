import { router } from './trpc.js'
import { emisRouter } from './routers/emis.js'

/**
 * Domains land here as we port. For Phase 2A only `emis` is mounted in
 * Task 9. Subsequent Phase 2 plans add investments, deposits, activity,
 * notifications, profile, push.
 */
export const appRouter = router({
  emis: emisRouter,
})

export type AppRouter = typeof appRouter
