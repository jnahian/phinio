import { beforeEach, describe, expect, it } from 'vitest'
import { withIdempotency } from '#/server/_idempotency'
import { createTestUser, prisma, resetDb } from './helpers/db'

beforeEach(async () => {
  await resetDb()
})

describe('withIdempotency', () => {
  it('runs the work and writes a processed_mutations row when an id is given', async () => {
    const user = await createTestUser()

    const result = await withIdempotency(user.profileId, 'cm-1', async (tx) => {
      await tx.investment.create({
        data: {
          profileId: user.profileId,
          name: 'First buy',
          type: 'stock',
          mode: 'lump_sum',
          investedAmount: '100.00',
          currentValue: '100.00',
        },
      })
      return { id: 'inv-1', count: 1 }
    })

    expect(result).toEqual({ id: 'inv-1', count: 1 })

    const stored = await prisma.processedMutation.findUnique({
      where: {
        profileId_clientMutationId: {
          profileId: user.profileId,
          clientMutationId: 'cm-1',
        },
      },
    })
    expect(stored).not.toBeNull()

    const inv = await prisma.investment.findFirst({
      where: { profileId: user.profileId },
    })
    expect(inv).not.toBeNull()
    expect(inv!.name).toBe('First buy')
  })

  it('replays the cached result and skips the work on duplicate id', async () => {
    const user = await createTestUser()
    let calls = 0

    const result1 = await withIdempotency(user.profileId, 'cm-2', async () => {
      calls++
      return { id: 'inv-2' }
    })

    const result2 = await withIdempotency(user.profileId, 'cm-2', async () => {
      calls++
      return { id: 'should-not-be-returned' }
    })

    expect(calls).toBe(1)
    expect(result2).toEqual(result1)
  })

  it('preserves Date instances across replay (superjson round-trip)', async () => {
    const user = await createTestUser()
    const originalDate = new Date('2026-04-29T10:00:00Z')

    type Shape = {
      id: string
      paidAt: Date
      payments: Array<{ id: string; dueDate: Date }>
    }

    const first = await withIdempotency<Shape>(
      user.profileId,
      'cm-3',
      async () => ({
        id: 'rec-1',
        paidAt: originalDate,
        payments: [{ id: 'p-1', dueDate: originalDate }],
      }),
    )

    const replay = await withIdempotency<Shape>(
      user.profileId,
      'cm-3',
      async () => {
        // Should not run; if it does the assertions below catch it.
        return { id: 'wrong', paidAt: new Date(0), payments: [] }
      },
    )

    expect(replay.paidAt).toBeInstanceOf(Date)
    expect(replay.paidAt.toISOString()).toBe(originalDate.toISOString())
    expect(replay.payments).toHaveLength(1)
    expect(replay.payments[0].dueDate).toBeInstanceOf(Date)
    expect(replay.payments[0].dueDate.toISOString()).toBe(
      originalDate.toISOString(),
    )
    // First-call result should also still be intact (sanity).
    expect(first.paidAt).toBeInstanceOf(Date)
  })

  it('treats different clientMutationIds independently', async () => {
    const user = await createTestUser()

    const a = await withIdempotency(user.profileId, 'cm-a', async () => ({
      label: 'A',
    }))
    const b = await withIdempotency(user.profileId, 'cm-b', async () => ({
      label: 'B',
    }))

    expect(a.label).toBe('A')
    expect(b.label).toBe('B')
  })

  it('runs the work but skips dedupe when clientMutationId is undefined', async () => {
    const user = await createTestUser()
    let calls = 0

    await withIdempotency(user.profileId, undefined, async () => {
      calls++
      return { id: '1' }
    })
    await withIdempotency(user.profileId, undefined, async () => {
      calls++
      return { id: '2' }
    })

    expect(calls).toBe(2)
    const count = await prisma.processedMutation.count()
    expect(count).toBe(0)
  })

  it('dedupes concurrent requests with the same clientMutationId', async () => {
    const user = await createTestUser({ email: 'concurrent@phinio.test' })
    let invocations = 0

    // Fire both calls in parallel. Both will pass the initial `findUnique`
    // (no row yet), both will run `fn`, both will try to insert the dedupe
    // row. Postgres serializes — one wins, the other gets P2002. The
    // helper catches the conflict and replays the winner's result.
    const [a, b] = await Promise.all([
      withIdempotency(user.profileId, 'cm-concurrent', async (tx) => {
        invocations++
        await tx.investment.create({
          data: {
            profileId: user.profileId,
            name: `Inv ${invocations}`,
            type: 'stock',
            mode: 'lump_sum',
            investedAmount: '100.00',
            currentValue: '100.00',
          },
        })
        return { name: `Inv ${invocations}` }
      }),
      withIdempotency(user.profileId, 'cm-concurrent', async (tx) => {
        invocations++
        await tx.investment.create({
          data: {
            profileId: user.profileId,
            name: `Inv ${invocations}`,
            type: 'stock',
            mode: 'lump_sum',
            investedAmount: '100.00',
            currentValue: '100.00',
          },
        })
        return { name: `Inv ${invocations}` }
      }),
    ])

    // Both callers get the same return value (the winner's result).
    expect(a).toEqual(b)

    // Only ONE investment row was committed — the loser's tx rolled back
    // atomically when its dedupe insert hit the unique index.
    const count = await prisma.investment.count({
      where: { profileId: user.profileId },
    })
    expect(count).toBe(1)

    // Exactly one dedupe row.
    const dedupeCount = await prisma.processedMutation.count({
      where: { profileId: user.profileId, clientMutationId: 'cm-concurrent' },
    })
    expect(dedupeCount).toBe(1)
  })

  it('scopes idempotency by profileId — same id from different profiles both run', async () => {
    const a = await createTestUser({ email: 'a-idem@phinio.test' })
    const b = await createTestUser({ email: 'b-idem@phinio.test' })
    let calls = 0

    await withIdempotency(a.profileId, 'shared-cm', async () => {
      calls++
      return { who: 'a' }
    })
    const second = await withIdempotency(b.profileId, 'shared-cm', async () => {
      calls++
      return { who: 'b' }
    })

    expect(calls).toBe(2)
    expect(second.who).toBe('b')
  })
})
