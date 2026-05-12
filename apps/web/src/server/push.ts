import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const saveSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().optional().nullable(),
})

const deleteSchema = z.object({
  endpoint: z.string().url(),
})

export const savePushSubscriptionFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, savePushSubscriptionImpl } =
      await import('./push.impl')
    return savePushSubscriptionImpl(await requireProfileId(), data)
  })

export const deletePushSubscriptionFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, deletePushSubscriptionImpl } =
      await import('./push.impl')
    return deletePushSubscriptionImpl(await requireProfileId(), data.endpoint)
  })

export const hasActivePushSubscriptionFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { requireProfileId, hasActivePushSubscriptionImpl } =
    await import('./push.impl')
  return hasActivePushSubscriptionImpl(await requireProfileId())
})
