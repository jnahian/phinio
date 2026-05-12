import { createServerFn } from '@tanstack/react-start'
import {
  clearReadNotificationsSchema,
  markAllNotificationsReadSchema,
  markNotificationReadSchema,
} from '@phinio/validators'

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. See `./investments.ts` for the rationale.

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
  .inputValidator((input: unknown) => markNotificationReadSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, markNotificationReadImpl } =
      await import('./notifications.impl')
    return markNotificationReadImpl(await requireProfileId(), data)
  })

export const markAllNotificationsReadFn = createServerFn({
  method: 'POST',
})
  .inputValidator((input: unknown) =>
    markAllNotificationsReadSchema.parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireProfileId, markAllNotificationsReadImpl } =
      await import('./notifications.impl')
    return markAllNotificationsReadImpl(await requireProfileId(), data)
  })

export const clearReadNotificationsFn = createServerFn({
  method: 'POST',
})
  .inputValidator((input: unknown) =>
    clearReadNotificationsSchema.parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireProfileId, clearReadNotificationsImpl } =
      await import('./notifications.impl')
    return clearReadNotificationsImpl(await requireProfileId(), data)
  })
