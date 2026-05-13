import { activityListQuerySchema } from '@phinio/validators'
import { listActivityImpl } from '../activity-log.js'
import { protectedProcedure, router } from '../trpc.js'

export const activityRouter = router({
  list: protectedProcedure
    .input(activityListQuerySchema)
    .query(({ ctx, input }) => listActivityImpl(ctx.prisma, ctx.profileId, input)),
})
