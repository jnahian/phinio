import { describe, expect, it } from 'vitest'
import { protectedProcedure, router } from '../trpc.js'

describe('protectedProcedure', () => {
  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const testRouter = router({
      ping: protectedProcedure.query(({ ctx }) => ctx.profileId),
    })
    const caller = testRouter.createCaller({
      prisma: {} as never,
      profileId: null,
      locale: 'en',
    })
    await expect(caller.ping()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('passes through authenticated callers with non-null profileId', async () => {
    const testRouter = router({
      ping: protectedProcedure.query(({ ctx }) => ctx.profileId),
    })
    const caller = testRouter.createCaller({
      prisma: {} as never,
      profileId: 'profile-123',
      locale: 'en',
    })
    expect(await caller.ping()).toBe('profile-123')
  })
})
