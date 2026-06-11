import {
  deletePushSubscriptionSchema,
  savePushSubscriptionSchema,
} from '@phinio/validators'
import { protectedProcedure, router } from '../trpc.js'

export const pushRouter = router({
  save: protectedProcedure
    .input(savePushSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          profileId: ctx.profileId,
          transport: input.transport,
          endpoint: input.endpoint,
          p256dh: input.p256dh ?? null,
          auth: input.auth ?? null,
          userAgent: input.userAgent ?? null,
        },
        update: {
          profileId: ctx.profileId,
          transport: input.transport,
          p256dh: input.p256dh ?? null,
          auth: input.auth ?? null,
          userAgent: input.userAgent ?? null,
          lastSeenAt: new Date(),
        },
      })
      return { ok: true as const }
    }),

  delete: protectedProcedure
    .input(deletePushSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, profileId: ctx.profileId },
      })
      return { ok: true as const }
    }),

  hasActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.pushSubscription.count({
      where: { profileId: ctx.profileId },
    })
    return { count }
  }),
})
