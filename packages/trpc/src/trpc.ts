import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { AppContext } from './context.js'

const t = initTRPC.context<AppContext>().create({
  transformer: superjson,
})

export const router = t.router
export const middleware = t.middleware
export const publicProcedure = t.procedure

/**
 * Requires an authenticated profile. The HTTP adapter is responsible for
 * resolving `profileId` from the session cookie / bearer token. If it's
 * null at procedure-call time, we return UNAUTHORIZED rather than letting
 * a downstream Prisma query crash with a confusing "where: { profileId:
 * null }" result.
 */
export const protectedProcedure = t.procedure.use(
  middleware(({ ctx, next }) => {
    if (!ctx.profileId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({ ctx: { ...ctx, profileId: ctx.profileId } })
  }),
)
