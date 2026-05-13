import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import type {
  DevDataResult,
  SeedCategories,
  SeedProfileInput,
} from './dev-data.impl'

export type { DevDataResult, SeedCategories, SeedProfileInput }

// Inlined here after profile.impl.ts was deleted in Phase 2E. Dev-data lives
// outside the tRPC surface (it predates Phase 2 and only runs from the
// profile screen's hidden "load test data" controls), so we keep the
// server-fn pattern instead of porting it.
async function requireUserId(): Promise<string> {
  const headers = new Headers(getRequestHeaders())
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error('Unauthorized')
  return session.user.id
}

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
    const { seedProfileDataImpl } = await import('./dev-data.impl')
    return seedProfileDataImpl(await requireUserId(), data)
  })

export const cleanupProfileDataFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<DevDataResult> => {
    const { cleanupProfileDataImpl } = await import('./dev-data.impl')
    return cleanupProfileDataImpl(await requireUserId())
  },
)
