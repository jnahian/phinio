import { router } from './trpc.js'

/**
 * Domains land here as we port. For Phase 2A only `emis` is mounted in
 * Task 9. Subsequent Phase 2 plans add investments, deposits, activity,
 * notifications, profile, push.
 */
export const appRouter = router({})

export type AppRouter = typeof appRouter
