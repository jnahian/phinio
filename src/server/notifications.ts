import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. See `./investments.ts` for the rationale.

const idSchema = z.object({ id: z.string().min(1) })

export const listNotificationsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireProfileId, listNotificationsImpl } =
      await import('./notifications.impl')
    return listNotificationsImpl(await requireProfileId())
  },
)

export const unreadNotificationCountFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { requireProfileId, unreadNotificationCountImpl } =
    await import('./notifications.impl')
  return unreadNotificationCountImpl(await requireProfileId())
})

export const markNotificationReadFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, markNotificationReadImpl } =
      await import('./notifications.impl')
    return markNotificationReadImpl(await requireProfileId(), data.id)
  })

export const markAllNotificationsReadFn = createServerFn({
  method: 'POST',
}).handler(async () => {
  const { requireProfileId, markAllNotificationsReadImpl } =
    await import('./notifications.impl')
  return markAllNotificationsReadImpl(await requireProfileId())
})
