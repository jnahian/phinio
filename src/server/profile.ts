import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SerializedProfile } from './profile.impl'

export type { SerializedProfile }

const updateCurrencySchema = z.object({
  preferredCurrency: z.enum(['BDT', 'USD']),
  clientMutationId: z.string().uuid().optional(),
})
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>

const updateNameSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  clientMutationId: z.string().uuid().optional(),
})
export type UpdateNameInput = z.infer<typeof updateNameSchema>

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

export const updateProfileNameFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => updateNameSchema.parse(input))
  .handler(async ({ data }): Promise<SerializedProfile> => {
    const { requireUserId, updateProfileNameImpl } =
      await import('./profile.impl')
    return updateProfileNameImpl(await requireUserId(), data)
  })
