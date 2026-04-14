import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SerializedProfile } from './profile.impl'

export type { SerializedProfile }

const updateCurrencySchema = z.object({
  preferredCurrency: z.enum(['BDT', 'USD']),
})
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>

export const getProfileFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SerializedProfile> => {
    const { requireUserId, getProfileImpl } = await import('./profile.impl')
    return getProfileImpl(await requireUserId())
  },
)

export const updateProfileCurrencyFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => updateCurrencySchema.parse(input))
  .handler(async ({ data }): Promise<SerializedProfile> => {
    const { requireUserId, updateProfileCurrencyImpl } =
      await import('./profile.impl')
    return updateProfileCurrencyImpl(await requireUserId(), data)
  })
