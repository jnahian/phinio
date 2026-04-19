import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  DevDataResult,
  SeedCategories,
  SeedProfileInput,
} from './dev-data.impl'

export type { DevDataResult, SeedCategories, SeedProfileInput }

const seedSchema = z.object({
  categories: z.object({
    lumpSum: z.boolean(),
    dps: z.boolean(),
    savings: z.boolean(),
    emis: z.boolean(),
  }),
  wipe: z.boolean(),
})

export const seedProfileDataFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => seedSchema.parse(input))
  .handler(async ({ data }): Promise<DevDataResult> => {
    const { requireUserId } = await import('./profile.impl')
    const { seedProfileDataImpl } = await import('./dev-data.impl')
    return seedProfileDataImpl(await requireUserId(), data)
  })

export const cleanupProfileDataFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<DevDataResult> => {
    const { requireUserId } = await import('./profile.impl')
    const { cleanupProfileDataImpl } = await import('./dev-data.impl')
    return cleanupProfileDataImpl(await requireUserId())
  },
)
