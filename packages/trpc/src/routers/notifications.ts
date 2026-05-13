import {
  clearReadNotificationsSchema,
  markAllNotificationsReadSchema,
  markNotificationReadSchema,
} from '@phinio/validators'
import { withIdempotency } from '../idempotency.js'
import { serializeNotification } from '../notifications.js'
import { protectedProcedure, router } from '../trpc.js'

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.notification.findMany({
      where: { profileId: ctx.profileId },
      orderBy: [
        { readAt: { sort: 'asc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
      take: 50,
    })
    return rows.map(serializeNotification)
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: { profileId: ctx.profileId, readAt: null },
    })
    return { count }
  }),

  markRead: protectedProcedure
    .input(markNotificationReadSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(
        ctx.prisma,
        ctx.profileId,
        input.clientMutationId,
        async (tx) => {
          const result = await tx.notification.updateMany({
            where: { id: input.id, profileId: ctx.profileId, readAt: null },
            data: { readAt: new Date() },
          })
          return { id: input.id, updated: result.count }
        },
      )
    }),

  markAllRead: protectedProcedure
    .input(markAllNotificationsReadSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(
        ctx.prisma,
        ctx.profileId,
        input.clientMutationId,
        async (tx) => {
          const result = await tx.notification.updateMany({
            where: { profileId: ctx.profileId, readAt: null },
            data: { readAt: new Date() },
          })
          return { updated: result.count }
        },
      )
    }),

  clearRead: protectedProcedure
    .input(clearReadNotificationsSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(
        ctx.prisma,
        ctx.profileId,
        input.clientMutationId,
        async (tx) => {
          const result = await tx.notification.deleteMany({
            where: { profileId: ctx.profileId, readAt: { not: null } },
          })
          return { deleted: result.count }
        },
      )
    }),
})
