import { beforeEach, describe, expect, it } from 'vitest'
import {
  createInvestmentImpl,
  deleteInvestmentImpl,
  getInvestmentImpl,
  listInvestmentsImpl,
  updateInvestmentImpl,
} from '#/server/investments'
import { createTestUser, resetDb } from './helpers/db'

beforeEach(async () => {
  await resetDb()
})

describe('investments server impls', () => {
  it('creates an investment scoped to the current profile', async () => {
    const user = await createTestUser()

    const created = await createInvestmentImpl(user.profileId, {
      name: 'Apple',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
      dateOfInvestment: '2026-01-15',
    })

    expect(created.name).toBe('Apple')
    expect(created.investedAmount).toBe('1000')
    expect(created.currentValue).toBe('1200')
    expect(created.status).toBe('active')
  })

  it('lists only the current profile’s investments (profileId scoping)', async () => {
    const alice = await createTestUser({ email: 'alice@phinio.test' })
    const bob = await createTestUser({ email: 'bob@phinio.test' })

    await createInvestmentImpl(alice.profileId, {
      name: 'Alice stock',
      type: 'stock',
      investedAmount: '500.00',
      currentValue: '550.00',
      dateOfInvestment: '2026-02-01',
    })
    await createInvestmentImpl(bob.profileId, {
      name: 'Bob gold',
      type: 'gold',
      investedAmount: '2000.00',
      currentValue: '2100.00',
      dateOfInvestment: '2026-02-05',
    })

    const aliceRows = await listInvestmentsImpl(alice.profileId, {
      status: 'active',
      type: 'all',
    })
    expect(aliceRows).toHaveLength(1)
    expect(aliceRows[0].name).toBe('Alice stock')

    const bobRows = await listInvestmentsImpl(bob.profileId, {
      status: 'active',
      type: 'all',
    })
    expect(bobRows).toHaveLength(1)
    expect(bobRows[0].name).toBe('Bob gold')
  })

  it('refuses updates and deletes to another profile’s investment', async () => {
    const alice = await createTestUser({ email: 'alice2@phinio.test' })
    const bob = await createTestUser({ email: 'bob2@phinio.test' })

    const aliceInv = await createInvestmentImpl(alice.profileId, {
      name: 'Alice fund',
      type: 'mutual_fund',
      investedAmount: '3000.00',
      currentValue: '3300.00',
      dateOfInvestment: '2026-01-20',
    })

    await expect(
      updateInvestmentImpl(bob.profileId, {
        id: aliceInv.id,
        name: 'Hacked',
        type: 'mutual_fund',
        investedAmount: '3000.00',
        currentValue: '10000.00',
        dateOfInvestment: '2026-01-20',
        status: 'active',
      }),
    ).rejects.toThrow(/not found/i)

    await expect(
      deleteInvestmentImpl(bob.profileId, aliceInv.id),
    ).rejects.toThrow(/not found/i)

    // Alice's row is untouched
    const stillThere = await getInvestmentImpl(alice.profileId, aliceInv.id)
    expect(stillThere.name).toBe('Alice fund')
    expect(stillThere.currentValue).toBe('3300')
  })

  it('marks an investment as completed with exit value and completion date', async () => {
    const user = await createTestUser()

    const inv = await createInvestmentImpl(user.profileId, {
      name: 'Gold',
      type: 'gold',
      investedAmount: '5000.00',
      currentValue: '6000.00',
      dateOfInvestment: '2025-12-01',
    })

    const updated = await updateInvestmentImpl(user.profileId, {
      id: inv.id,
      name: 'Gold',
      type: 'gold',
      investedAmount: '5000.00',
      currentValue: '6500.00',
      dateOfInvestment: '2025-12-01',
      status: 'completed',
      exitValue: '6500.00',
      completedAt: '2026-03-15',
    })

    expect(updated.status).toBe('completed')
    expect(updated.exitValue).toBe('6500')

    const active = await listInvestmentsImpl(user.profileId, {
      status: 'active',
      type: 'all',
    })
    expect(active).toHaveLength(0)

    const completed = await listInvestmentsImpl(user.profileId, {
      status: 'completed',
      type: 'all',
    })
    expect(completed).toHaveLength(1)
    expect(completed[0].id).toBe(inv.id)
  })

  it('filters the list by investment type', async () => {
    const user = await createTestUser()

    await createInvestmentImpl(user.profileId, {
      name: 'Stock A',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })
    await createInvestmentImpl(user.profileId, {
      name: 'Gold bar',
      type: 'gold',
      investedAmount: '2000.00',
      currentValue: '2000.00',
      dateOfInvestment: '2026-01-02',
    })

    const stocksOnly = await listInvestmentsImpl(user.profileId, {
      status: 'active',
      type: 'stock',
    })
    expect(stocksOnly).toHaveLength(1)
    expect(stocksOnly[0].name).toBe('Stock A')
  })

  it('throws a clear error when fetching an investment that does not exist', async () => {
    const user = await createTestUser()
    await expect(
      getInvestmentImpl(user.profileId, 'does-not-exist'),
    ).rejects.toThrow(/not found/i)
  })
})
