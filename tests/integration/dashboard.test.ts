import { beforeEach, describe, expect, it } from 'vitest'
import { getDashboardStatsImpl } from '#/server/dashboard.impl'
import { createTestUser, prisma, resetDb } from './helpers/db'

beforeEach(async () => {
  await resetDb()
})

// Helpers --------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

function daysFromNow(days: number): Date {
  // Use midnight UTC so @db.Date round-trips without timezone drift.
  const d = new Date(Date.now() + days * DAY_MS)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function insertInvestment(
  profileId: string,
  opts: {
    name?: string
    type?: string
    investedAmount: string
    currentValue: string
    status?: string
    dateOfInvestment?: Date
  },
) {
  return prisma.investment.create({
    data: {
      profileId,
      name: opts.name ?? 'Test investment',
      type: opts.type ?? 'stock',
      investedAmount: opts.investedAmount,
      currentValue: opts.currentValue,
      dateOfInvestment: opts.dateOfInvestment ?? new Date('2026-01-01'),
      status: opts.status ?? 'active',
    },
  })
}

async function insertEmi(
  profileId: string,
  opts: {
    label?: string
    type?: string
    principal?: string
    interestRate?: string
    tenureMonths?: number
    emiAmount: string
    startDate?: Date
    status?: string
  },
) {
  return prisma.emi.create({
    data: {
      profileId,
      label: opts.label ?? 'Test EMI',
      type: opts.type ?? 'loan',
      principal: opts.principal ?? '10000.00',
      interestRate: opts.interestRate ?? '10.00',
      tenureMonths: opts.tenureMonths ?? 12,
      emiAmount: opts.emiAmount,
      startDate: opts.startDate ?? new Date('2026-01-01'),
      status: opts.status ?? 'active',
    },
  })
}

async function insertPayment(
  profileId: string,
  emiId: string,
  opts: {
    paymentNumber: number
    dueDate: Date
    emiAmount: string
    principalComponent?: string
    interestComponent?: string
    remainingBalance: string
    status?: string
  },
) {
  return prisma.emiPayment.create({
    data: {
      emiId,
      profileId,
      paymentNumber: opts.paymentNumber,
      dueDate: opts.dueDate,
      emiAmount: opts.emiAmount,
      principalComponent: opts.principalComponent ?? '0.00',
      interestComponent: opts.interestComponent ?? '0.00',
      remainingBalance: opts.remainingBalance,
      status: opts.status ?? 'upcoming',
    },
  })
}

// Tests ----------------------------------------------------------------------

describe('getDashboardStatsImpl', () => {
  it('returns all zeros for a freshly created profile with no data', async () => {
    const user = await createTestUser()

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.netWorth).toBe('0.00')
    expect(stats.investmentTotals.invested).toBe('0.00')
    expect(stats.investmentTotals.current).toBe('0.00')
    expect(stats.investmentTotals.gainLossPercent).toBe(0)
    expect(stats.monthlyEmiOutflow).toBe('0.00')
    expect(stats.allocation).toEqual([])
    expect(stats.upcomingPayments).toEqual([])
  })

  it('sums invested and current across multiple active investments', async () => {
    const user = await createTestUser()
    await insertInvestment(user.profileId, {
      name: 'A',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
    })
    await insertInvestment(user.profileId, {
      name: 'B',
      type: 'gold',
      investedAmount: '500.00',
      currentValue: '600.00',
    })
    await insertInvestment(user.profileId, {
      name: 'C',
      type: 'mutual_fund',
      investedAmount: '2000.00',
      currentValue: '1800.00',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    // 1000 + 500 + 2000 = 3500; 1200 + 600 + 1800 = 3600
    expect(stats.investmentTotals.invested).toBe('3500.00')
    expect(stats.investmentTotals.current).toBe('3600.00')
    // (3600 - 3500) / 3500 * 100 = 2.857142... -> rounded to 2.86
    expect(stats.investmentTotals.gainLossPercent).toBe(2.86)
  })

  it('rounds gainLossPercent to 2 decimal places', async () => {
    const user = await createTestUser()
    // Raw gain: (1123.45 - 1000) / 1000 * 100 = 12.345 -> rounds to 12.35
    await insertInvestment(user.profileId, {
      investedAmount: '1000.00',
      currentValue: '1123.45',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.investmentTotals.gainLossPercent).toBe(12.35)
  })

  it('excludes completed investments from totals and allocation', async () => {
    const user = await createTestUser()
    await insertInvestment(user.profileId, {
      name: 'Active',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
      status: 'active',
    })
    await insertInvestment(user.profileId, {
      name: 'Done',
      type: 'gold',
      investedAmount: '9999.00',
      currentValue: '9999.00',
      status: 'completed',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.investmentTotals.invested).toBe('1000.00')
    expect(stats.investmentTotals.current).toBe('1200.00')
    expect(stats.allocation).toHaveLength(1)
    expect(stats.allocation[0].type).toBe('stock')
  })

  it('groups allocation by type and sorts by value descending', async () => {
    const user = await createTestUser()
    await insertInvestment(user.profileId, {
      name: 'Stock1',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1500.00',
    })
    await insertInvestment(user.profileId, {
      name: 'Stock2',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1500.00',
    })
    await insertInvestment(user.profileId, {
      name: 'Gold1',
      type: 'gold',
      investedAmount: '1000.00',
      currentValue: '1000.00',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    // 3000 stock, 1000 gold — total 4000
    expect(stats.allocation).toHaveLength(2)
    expect(stats.allocation[0].type).toBe('stock')
    expect(stats.allocation[0].value).toBe('3000.00')
    expect(stats.allocation[1].type).toBe('gold')
    expect(stats.allocation[1].value).toBe('1000.00')

    // Percents should sum to ~100 (each rounded independently)
    const totalPct = stats.allocation[0].percent + stats.allocation[1].percent
    expect(Math.abs(totalPct - 100)).toBeLessThan(0.1)
    expect(stats.allocation[0].percent).toBe(75)
    expect(stats.allocation[1].percent).toBe(25)
  })

  it('guards against division-by-zero in allocation percent when no investments', async () => {
    const user = await createTestUser()

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.allocation).toEqual([])
    expect(stats.investmentTotals.gainLossPercent).toBe(0)
  })

  it('monthlyEmiOutflow sums emiAmount across all active EMIs', async () => {
    const user = await createTestUser()
    await insertEmi(user.profileId, {
      label: 'Car',
      emiAmount: '1250.50',
    })
    await insertEmi(user.profileId, {
      label: 'Home',
      emiAmount: '4500.25',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.monthlyEmiOutflow).toBe('5750.75')
  })

  it('computes netWorth as current investments minus remaining EMI balance', async () => {
    const user = await createTestUser()
    await insertInvestment(user.profileId, {
      investedAmount: '800.00',
      currentValue: '1000.00',
    })
    const emi = await insertEmi(user.profileId, {
      emiAmount: '100.00',
    })
    await insertPayment(user.profileId, emi.id, {
      paymentNumber: 1,
      dueDate: daysFromNow(15),
      emiAmount: '100.00',
      remainingBalance: '400.00',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.netWorth).toBe('600.00')
  })

  it('uses the next UNPAID payment (not a paid one) for remaining EMI balance', async () => {
    const user = await createTestUser()
    await insertInvestment(user.profileId, {
      investedAmount: '500.00',
      currentValue: '1000.00',
    })
    const emi = await insertEmi(user.profileId, { emiAmount: '100.00' })
    // Payment #1 is paid — should be ignored.
    await insertPayment(user.profileId, emi.id, {
      paymentNumber: 1,
      dueDate: daysFromNow(-10),
      emiAmount: '100.00',
      remainingBalance: '900.00',
      status: 'paid',
    })
    // Payment #2 is the next unpaid — its remainingBalance should be used.
    await insertPayment(user.profileId, emi.id, {
      paymentNumber: 2,
      dueDate: daysFromNow(20),
      emiAmount: '100.00',
      remainingBalance: '250.00',
      status: 'upcoming',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    // 1000 current - 250 next-unpaid remaining = 750
    expect(stats.netWorth).toBe('750.00')
  })

  it('returns at most 5 upcoming payments sorted by dueDate ascending', async () => {
    const user = await createTestUser()
    const emi = await insertEmi(user.profileId, { emiAmount: '100.00' })

    // 7 unpaid payments, staggered across the next 30 days.
    const offsets = [25, 3, 18, 1, 10, 7, 14]
    for (let i = 0; i < offsets.length; i++) {
      await insertPayment(user.profileId, emi.id, {
        paymentNumber: i + 1,
        dueDate: daysFromNow(offsets[i]),
        emiAmount: '100.00',
        remainingBalance: `${1000 - i * 100}.00`,
      })
    }

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.upcomingPayments).toHaveLength(5)
    // Ordered ascending by dueDate.
    const due = stats.upcomingPayments.map((p) => p.dueDate.getTime())
    for (let i = 1; i < due.length; i++) {
      expect(due[i]).toBeGreaterThanOrEqual(due[i - 1])
    }
    // daysUntilDue uses Math.round on (dueDate - now), and our dueDates are
    // UTC midnight — so the rounded count can land one day lower depending on
    // the wall-clock hour. Assert the *relative* offsets match the five
    // smallest from [25, 3, 18, 1, 10, 7, 14] → [1, 3, 7, 10, 14], allowing
    // a uniform ±1 drift across the whole array.
    const days = stats.upcomingPayments.map((p) => p.daysUntilDue)
    const expectedOffsets = [1, 3, 7, 10, 14]
    const drift = days[0] - expectedOffsets[0]
    expect(Math.abs(drift)).toBeLessThanOrEqual(1)
    for (let i = 0; i < expectedOffsets.length; i++) {
      expect(days[i]).toBe(expectedOffsets[i] + drift)
    }
  })

  it('excludes upcoming payments with dueDate beyond 30 days', async () => {
    const user = await createTestUser()
    const emi = await insertEmi(user.profileId, {
      label: 'Loan X',
      type: 'loan',
      emiAmount: '100.00',
    })
    await insertPayment(user.profileId, emi.id, {
      paymentNumber: 1,
      dueDate: daysFromNow(1),
      emiAmount: '100.00',
      remainingBalance: '900.00',
    })
    await insertPayment(user.profileId, emi.id, {
      paymentNumber: 2,
      dueDate: daysFromNow(60),
      emiAmount: '100.00',
      remainingBalance: '800.00',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.upcomingPayments).toHaveLength(1)
    expect(stats.upcomingPayments[0].paymentNumber).toBe(1)
    expect(stats.upcomingPayments[0].emiLabel).toBe('Loan X')
    expect(stats.upcomingPayments[0].emiType).toBe('loan')
    expect(stats.upcomingPayments[0].emiId).toBe(emi.id)
  })

  it('marks past-due unpaid payments as isOverdue with non-positive daysUntilDue', async () => {
    const user = await createTestUser()
    const emi = await insertEmi(user.profileId, { emiAmount: '100.00' })
    await insertPayment(user.profileId, emi.id, {
      paymentNumber: 1,
      dueDate: daysFromNow(-1),
      emiAmount: '100.00',
      remainingBalance: '900.00',
    })

    const stats = await getDashboardStatsImpl(user.profileId)

    expect(stats.upcomingPayments).toHaveLength(1)
    const [p] = stats.upcomingPayments
    expect(p.isOverdue).toBe(true)
    expect(p.daysUntilDue).toBeLessThanOrEqual(0)
  })

  it('scopes every aggregation to the requested profileId (Alice cannot see Bob)', async () => {
    const alice = await createTestUser({ email: 'alice-dash@phinio.test' })
    const bob = await createTestUser({ email: 'bob-dash@phinio.test' })

    // Alice: 1 investment, 1 active EMI with an upcoming payment.
    await insertInvestment(alice.profileId, {
      name: 'Alice stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
    })
    const aliceEmi = await insertEmi(alice.profileId, {
      label: 'Alice loan',
      emiAmount: '150.00',
    })
    await insertPayment(alice.profileId, aliceEmi.id, {
      paymentNumber: 1,
      dueDate: daysFromNow(10),
      emiAmount: '150.00',
      remainingBalance: '300.00',
    })

    // Bob: completely different numbers.
    await insertInvestment(bob.profileId, {
      name: 'Bob gold',
      type: 'gold',
      investedAmount: '5000.00',
      currentValue: '7000.00',
    })
    const bobEmi = await insertEmi(bob.profileId, {
      label: 'Bob loan',
      emiAmount: '999.00',
    })
    await insertPayment(bob.profileId, bobEmi.id, {
      paymentNumber: 1,
      dueDate: daysFromNow(5),
      emiAmount: '999.00',
      remainingBalance: '9000.00',
    })

    const aliceStats = await getDashboardStatsImpl(alice.profileId)

    expect(aliceStats.investmentTotals.invested).toBe('1000.00')
    expect(aliceStats.investmentTotals.current).toBe('1200.00')
    expect(aliceStats.monthlyEmiOutflow).toBe('150.00')
    // 1200 current - 300 remaining = 900
    expect(aliceStats.netWorth).toBe('900.00')
    expect(aliceStats.allocation).toHaveLength(1)
    expect(aliceStats.allocation[0].type).toBe('stock')
    expect(aliceStats.upcomingPayments).toHaveLength(1)
    expect(aliceStats.upcomingPayments[0].emiLabel).toBe('Alice loan')
    expect(aliceStats.upcomingPayments[0].emiId).toBe(aliceEmi.id)

    const bobStats = await getDashboardStatsImpl(bob.profileId)
    expect(bobStats.monthlyEmiOutflow).toBe('999.00')
    expect(bobStats.upcomingPayments).toHaveLength(1)
    expect(bobStats.upcomingPayments[0].emiLabel).toBe('Bob loan')
  })
})
