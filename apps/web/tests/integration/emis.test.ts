import { beforeEach, describe, expect, it } from 'vitest'
import type { AppContext } from '@phinio/trpc'
import { appRouter } from '@phinio/trpc'
import { createTestUser, prisma, resetDb } from './helpers/db'

function callerFor(profileId: string) {
  const ctx: AppContext = { prisma, profileId, locale: 'en' }
  return appRouter.createCaller(ctx)
}

beforeEach(async () => {
  await resetDb()
})

describe('emis server impls', () => {
  it('createEmiImpl generates the full amortization schedule up front', async () => {
    const user = await createTestUser()

    const created = await callerFor(user.profileId).emis.create({
      label: 'Car loan',
      type: 'bank_loan',
      principal: '100000',
      interestRate: '12',
      tenureMonths: 12,
      startDate: '2026-01-15',
    })

    const count = await prisma.emiPayment.count({
      where: { emiId: created.id },
    })
    expect(count).toBe(12)
  })

  it('createEmiImpl without processingFee produces only the regular schedule', async () => {
    const user = await createTestUser({ email: 'no-fee@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Plain loan',
      type: 'bank_loan',
      principal: '50000',
      interestRate: '12',
      tenureMonths: 6,
      startDate: '2026-03-01',
    })

    const payments = await prisma.emiPayment.findMany({
      where: { emiId: created.id },
      orderBy: { paymentNumber: 'asc' },
    })
    expect(payments).toHaveLength(6)
    expect(payments[0].paymentNumber).toBe(1)
    expect(created.processingFee).toBeNull()
  })

  it('createEmiImpl with processingFee inserts a paid paymentNumber=0 row', async () => {
    const user = await createTestUser({ email: 'fee@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Loan with fee',
      type: 'bank_loan',
      principal: '100000',
      interestRate: '12',
      tenureMonths: 12,
      startDate: '2026-04-01',
      processingFee: '2000',
    })

    expect(created.processingFee).toBe('2000')

    const payments = await prisma.emiPayment.findMany({
      where: { emiId: created.id },
      orderBy: { paymentNumber: 'asc' },
    })
    expect(payments).toHaveLength(13) // 12 monthly + 1 fee row

    const feeRow = payments[0]
    expect(feeRow.paymentNumber).toBe(0)
    expect(feeRow.status).toBe('paid')
    expect(feeRow.paidAt).toBeInstanceOf(Date)
    expect(String(feeRow.emiAmount)).toBe('2000')
    expect(String(feeRow.principalComponent)).toBe('0')
    expect(String(feeRow.interestComponent)).toBe('0')
    expect(String(feeRow.remainingBalance)).toBe('100000')

    // Regular schedule remains 1-indexed and unaffected by the fee.
    expect(payments[1].paymentNumber).toBe(1)
    expect(payments[12].paymentNumber).toBe(12)
  })

  it('createEmiImpl ignores zero / empty processingFee', async () => {
    const user = await createTestUser({ email: 'zero-fee@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Zero fee',
      type: 'bank_loan',
      principal: '50000',
      interestRate: '10',
      tenureMonths: 6,
      startDate: '2026-05-01',
      processingFee: '0',
    })

    const payments = await prisma.emiPayment.findMany({
      where: { emiId: created.id },
    })
    expect(payments).toHaveLength(6)
    expect(payments.find((p) => p.paymentNumber === 0)).toBeUndefined()
    expect(created.processingFee).toBeNull()
  })

  it('getEmiImpl exposes processingFee derived from the paymentNumber=0 row', async () => {
    const user = await createTestUser({ email: 'get-fee@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Loan',
      type: 'bank_loan',
      principal: '80000',
      interestRate: '11',
      tenureMonths: 8,
      startDate: '2026-06-01',
      processingFee: '1500',
    })

    const fetched = await callerFor(user.profileId).emis.get({ emiId: created.id })
    expect(fetched.processingFee).toBe('1500')
    expect(fetched.payments[0].paymentNumber).toBe(0)
  })

  it('listEmisImpl progress counts ignore the processing-fee row', async () => {
    const user = await createTestUser({ email: 'list-fee@phinio.test' })

    await callerFor(user.profileId).emis.create({
      label: 'Loan with fee',
      type: 'bank_loan',
      principal: '60000',
      interestRate: '10',
      tenureMonths: 6,
      startDate: '2026-07-01',
      processingFee: '500',
    })

    const rows = await callerFor(user.profileId).emis.list({
      type: 'all',
      status: 'active',
    })
    expect(rows).toHaveLength(1)
    // 6 regular months — fee row is excluded, even though it counts as "paid".
    expect(rows[0].totalPayments).toBe(6)
    expect(rows[0].paidCount).toBe(0)
  })

  it('upcomingPaymentsImpl excludes the fee row even if its status drifts off paid', async () => {
    const user = await createTestUser({ email: 'fee-upcoming@phinio.test' })

    // Start = tomorrow so regular payments would land in the upcoming window.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const yyyy = tomorrow.getFullYear()
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')
    const startDate = `${yyyy}-${mm}-${dd}`

    const created = await callerFor(user.profileId).emis.create({
      label: 'Loan with fee',
      type: 'bank_loan',
      principal: '60000',
      interestRate: '12',
      tenureMonths: 6,
      startDate,
      processingFee: '500',
    })

    // Force the fee row into a non-paid state to ensure the
    // `paymentNumber > 0` filter is what excludes it (not just the status
    // filter). Bypass markPaymentPaidImpl, which guards against this.
    await prisma.emiPayment.updateMany({
      where: { emiId: created.id, paymentNumber: 0 },
      data: { status: 'upcoming', paidAt: null },
    })

    const rows = await callerFor(user.profileId).emis.upcomingPayments()
    for (const r of rows) {
      expect(r.paymentNumber).toBeGreaterThan(0)
    }
  })

  it('markPaymentPaidImpl rejects toggling the processing-fee row', async () => {
    const user = await createTestUser({ email: 'fee-toggle@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Loan',
      type: 'bank_loan',
      principal: '40000',
      interestRate: '10',
      tenureMonths: 4,
      startDate: '2026-08-01',
      processingFee: '300',
    })

    const feeRow = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: created.id, paymentNumber: 0 },
    })

    await expect(
      callerFor(user.profileId).emis.markPaymentPaid({
        paymentId: feeRow.id,
        paid: false,
      }),
    ).rejects.toThrow(/processing fee/i)
  })

  it('zero-interest EMI creates all rows with interestComponent "0.00"', async () => {
    const user = await createTestUser()

    const created = await callerFor(user.profileId).emis.create({
      label: 'Zero interest plan',
      type: 'credit_card',
      principal: '12000',
      interestRate: '0',
      tenureMonths: 12,
      startDate: '2026-01-01',
    })

    const payments = await prisma.emiPayment.findMany({
      where: { emiId: created.id },
      orderBy: { paymentNumber: 'asc' },
    })

    expect(payments).toHaveLength(12)
    for (const p of payments) {
      expect(String(p.interestComponent)).toBe('0')
      expect(String(p.principalComponent)).toBe('1000')
    }
  })

  it('listEmisImpl returns only the caller’s rows (profileId scoping)', async () => {
    const alice = await createTestUser({ email: 'alice1@phinio.test' })
    const bob = await createTestUser({ email: 'bob1@phinio.test' })

    await callerFor(alice.profileId).emis.create({
      label: 'Alice loan',
      type: 'bank_loan',
      principal: '50000',
      interestRate: '10',
      tenureMonths: 6,
      startDate: '2026-01-01',
    })
    await callerFor(bob.profileId).emis.create({
      label: 'Bob card',
      type: 'credit_card',
      principal: '20000',
      interestRate: '18',
      tenureMonths: 6,
      startDate: '2026-01-01',
    })

    const aliceRows = await callerFor(alice.profileId).emis.list({
      type: 'all',
      status: 'active',
    })
    expect(aliceRows).toHaveLength(1)
    expect(aliceRows[0].label).toBe('Alice loan')

    const bobRows = await callerFor(bob.profileId).emis.list({
      type: 'all',
      status: 'active',
    })
    expect(bobRows).toHaveLength(1)
    expect(bobRows[0].label).toBe('Bob card')
  })

  it('listEmisImpl filters by type', async () => {
    const user = await createTestUser({ email: 'filter@phinio.test' })

    await callerFor(user.profileId).emis.create({
      label: 'Home loan',
      type: 'bank_loan',
      principal: '500000',
      interestRate: '9',
      tenureMonths: 24,
      startDate: '2026-01-01',
    })
    await callerFor(user.profileId).emis.create({
      label: 'Visa card',
      type: 'credit_card',
      principal: '15000',
      interestRate: '24',
      tenureMonths: 6,
      startDate: '2026-01-01',
    })

    const loans = await callerFor(user.profileId).emis.list({
      type: 'bank_loan',
      status: 'active',
    })
    expect(loans).toHaveLength(1)
    expect(loans[0].label).toBe('Home loan')

    const cards = await callerFor(user.profileId).emis.list({
      type: 'credit_card',
      status: 'active',
    })
    expect(cards).toHaveLength(1)
    expect(cards[0].label).toBe('Visa card')

    const all = await callerFor(user.profileId).emis.list({
      type: 'all',
      status: 'active',
    })
    expect(all).toHaveLength(2)
  })

  it('listEmisImpl filters by status — completed EMIs only show on the completed tab', async () => {
    const user = await createTestUser({ email: 'list-status@phinio.test' })

    const ongoing = await callerFor(user.profileId).emis.create({
      label: 'Ongoing loan',
      type: 'bank_loan',
      principal: '60000',
      interestRate: '12',
      tenureMonths: 6,
      startDate: '2026-01-01',
    })
    const finished = await callerFor(user.profileId).emis.create({
      label: 'Finished loan',
      type: 'bank_loan',
      principal: '20000',
      interestRate: '10',
      tenureMonths: 2,
      startDate: '2026-01-01',
    })
    await callerFor(user.profileId).emis.complete({ emiId: finished.id })

    const active = await callerFor(user.profileId).emis.list({
      type: 'all',
      status: 'active',
    })
    expect(active.map((e) => e.id)).toEqual([ongoing.id])

    const completed = await callerFor(user.profileId).emis.list({
      type: 'all',
      status: 'completed',
    })
    expect(completed.map((e) => e.id)).toEqual([finished.id])
  })

  it('listEmisImpl computes totalPayments / paidCount / nextDueDate / remainingBalance from payments', async () => {
    const user = await createTestUser({ email: 'derived@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Short loan',
      type: 'bank_loan',
      principal: '30000',
      interestRate: '12',
      tenureMonths: 3,
      startDate: '2026-01-15',
    })

    const payments = await prisma.emiPayment.findMany({
      where: { emiId: created.id },
      orderBy: { paymentNumber: 'asc' },
    })
    expect(payments).toHaveLength(3)

    await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: payments[0].id,
      paid: true,
    })

    const rows = await callerFor(user.profileId).emis.list({
      type: 'all',
      status: 'active',
    })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.totalPayments).toBe(3)
    expect(row.paidCount).toBe(1)
    expect(row.nextDueDate).toEqual(payments[1].dueDate)
    expect(row.remainingBalance).toBe(String(payments[1].remainingBalance))
  })

  it('getEmiImpl returns the full payments array sorted by paymentNumber', async () => {
    const user = await createTestUser({ email: 'get@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Six month loan',
      type: 'bank_loan',
      principal: '60000',
      interestRate: '12',
      tenureMonths: 6,
      startDate: '2026-02-01',
    })

    const fetched = await callerFor(user.profileId).emis.get({ emiId: created.id })
    expect(fetched.payments).toHaveLength(6)
    for (let i = 0; i < 6; i++) {
      expect(fetched.payments[i].paymentNumber).toBe(i + 1)
    }
  })

  it('getEmiImpl refuses cross-profile access', async () => {
    const alice = await createTestUser({ email: 'alice2@phinio.test' })
    const bob = await createTestUser({ email: 'bob2@phinio.test' })

    const aliceEmi = await callerFor(alice.profileId).emis.create({
      label: 'Alice private loan',
      type: 'bank_loan',
      principal: '25000',
      interestRate: '10',
      tenureMonths: 4,
      startDate: '2026-01-01',
    })

    await expect(callerFor(bob.profileId).emis.get({ emiId: aliceEmi.id })).rejects.toThrow(
      /not found/i,
    )
  })

  it('deleteEmiImpl refuses cross-profile delete', async () => {
    const alice = await createTestUser({ email: 'alice3@phinio.test' })
    const bob = await createTestUser({ email: 'bob3@phinio.test' })

    const aliceEmi = await callerFor(alice.profileId).emis.create({
      label: 'Alice loan 2',
      type: 'bank_loan',
      principal: '10000',
      interestRate: '8',
      tenureMonths: 4,
      startDate: '2026-01-01',
    })

    await expect(
      callerFor(bob.profileId).emis.delete({ emiId: aliceEmi.id }),
    ).rejects.toThrow(/not found/i)

    // Alice's row still exists
    const still = await callerFor(alice.profileId).emis.get({ emiId: aliceEmi.id })
    expect(still.label).toBe('Alice loan 2')
  })

  it('deleteEmiImpl cascades to the payments', async () => {
    const user = await createTestUser({ email: 'cascade@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'To be deleted',
      type: 'bank_loan',
      principal: '60000',
      interestRate: '12',
      tenureMonths: 6,
      startDate: '2026-01-01',
    })

    const before = await prisma.emiPayment.count({
      where: { emiId: created.id },
    })
    expect(before).toBe(6)

    await callerFor(user.profileId).emis.delete({ emiId: created.id })

    const after = await prisma.emiPayment.count({
      where: { emiId: created.id },
    })
    expect(after).toBe(0)
    const emiCount = await prisma.emi.count({ where: { id: created.id } })
    expect(emiCount).toBe(0)
  })

  it('markPaymentPaidImpl sets status to paid and records paidAt', async () => {
    const user = await createTestUser({ email: 'markpaid@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Mark paid loan',
      type: 'bank_loan',
      principal: '30000',
      interestRate: '12',
      tenureMonths: 3,
      startDate: '2026-01-01',
    })

    const payment = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: created.id, paymentNumber: 1 },
    })

    await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: payment.id,
      paid: true,
    })

    const reloaded = await prisma.emiPayment.findUniqueOrThrow({
      where: { id: payment.id },
    })
    expect(reloaded.status).toBe('paid')
    expect(reloaded.paidAt).toBeInstanceOf(Date)
  })

  it('markPaymentPaidImpl toggles back to upcoming and clears paidAt', async () => {
    const user = await createTestUser({ email: 'toggle@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Toggle loan',
      type: 'bank_loan',
      principal: '30000',
      interestRate: '12',
      tenureMonths: 3,
      startDate: '2026-01-01',
    })
    const payment = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: created.id, paymentNumber: 1 },
    })

    await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: payment.id,
      paid: true,
    })
    await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: payment.id,
      paid: false,
    })

    const reloaded = await prisma.emiPayment.findUniqueOrThrow({
      where: { id: payment.id },
    })
    expect(reloaded.status).toBe('upcoming')
    expect(reloaded.paidAt).toBeNull()
  })

  it('markPaymentPaidImpl refuses cross-profile updates', async () => {
    const alice = await createTestUser({ email: 'alice4@phinio.test' })
    const bob = await createTestUser({ email: 'bob4@phinio.test' })

    const aliceEmi = await callerFor(alice.profileId).emis.create({
      label: 'Alice private',
      type: 'bank_loan',
      principal: '30000',
      interestRate: '12',
      tenureMonths: 3,
      startDate: '2026-01-01',
    })
    const alicePayment = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: aliceEmi.id, paymentNumber: 1 },
    })
    const originalStatus = alicePayment.status

    await expect(
      callerFor(bob.profileId).emis.markPaymentPaid({
        paymentId: alicePayment.id,
        paid: true,
      }),
    ).rejects.toThrow(/not found/i)

    const reloaded = await prisma.emiPayment.findUniqueOrThrow({
      where: { id: alicePayment.id },
    })
    expect(reloaded.status).toBe(originalStatus)
    expect(reloaded.paidAt).toBeNull()
  })

  it('markPaymentPaidImpl auto-completes the EMI when the last installment is paid', async () => {
    const user = await createTestUser({ email: 'auto-complete@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Short loan',
      type: 'bank_loan',
      principal: '20000',
      interestRate: '12',
      tenureMonths: 2,
      startDate: '2026-01-01',
    })

    const payments = await prisma.emiPayment.findMany({
      where: { emiId: created.id, paymentNumber: { gt: 0 } },
      orderBy: { paymentNumber: 'asc' },
    })

    const first = await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: payments[0].id,
      paid: true,
    })
    expect(first.autoCompleted).toBe(false)
    let reloadedEmi = await prisma.emi.findUniqueOrThrow({
      where: { id: created.id },
    })
    expect(reloadedEmi.status).toBe('active')

    const second = await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: payments[1].id,
      paid: true,
    })
    expect(second.autoCompleted).toBe(true)
    reloadedEmi = await prisma.emi.findUniqueOrThrow({
      where: { id: created.id },
    })
    expect(reloadedEmi.status).toBe('completed')
  })

  it('markPaymentPaidImpl reopens a completed EMI when a paid installment is unmarked', async () => {
    const user = await createTestUser({ email: 'reopen@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Reopen loan',
      type: 'bank_loan',
      principal: '20000',
      interestRate: '12',
      tenureMonths: 2,
      startDate: '2026-01-01',
    })

    await callerFor(user.profileId).emis.complete({ emiId: created.id })

    const lastPayment = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: created.id, paymentNumber: 2 },
    })

    await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: lastPayment.id,
      paid: false,
    })

    const reloadedEmi = await prisma.emi.findUniqueOrThrow({
      where: { id: created.id },
    })
    expect(reloadedEmi.status).toBe('active')
  })

  it('completeEmiImpl marks remaining installments paid and sets status to completed', async () => {
    const user = await createTestUser({ email: 'complete-emi@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Prepay loan',
      type: 'bank_loan',
      principal: '60000',
      interestRate: '12',
      tenureMonths: 6,
      startDate: '2026-01-01',
    })

    const firstPayment = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: created.id, paymentNumber: 1 },
    })
    await callerFor(user.profileId).emis.markPaymentPaid({
      paymentId: firstPayment.id,
      paid: true,
    })

    const result = await callerFor(user.profileId).emis.complete({ emiId: created.id })
    expect(result.alreadyCompleted).toBe(false)

    const emi = await prisma.emi.findUniqueOrThrow({
      where: { id: created.id },
    })
    expect(emi.status).toBe('completed')

    const unpaid = await prisma.emiPayment.count({
      where: {
        emiId: created.id,
        paymentNumber: { gt: 0 },
        status: { not: 'paid' },
      },
    })
    expect(unpaid).toBe(0)
  })

  it('completeEmiImpl is idempotent on already-completed EMIs', async () => {
    const user = await createTestUser({ email: 'idemp-complete@phinio.test' })

    const created = await callerFor(user.profileId).emis.create({
      label: 'Already done',
      type: 'bank_loan',
      principal: '10000',
      interestRate: '10',
      tenureMonths: 1,
      startDate: '2026-01-01',
    })
    await callerFor(user.profileId).emis.complete({ emiId: created.id })

    const second = await callerFor(user.profileId).emis.complete({ emiId: created.id })
    expect(second.alreadyCompleted).toBe(true)
  })

  it('completeEmiImpl refuses cross-profile completion', async () => {
    const alice = await createTestUser({ email: 'alice-complete@phinio.test' })
    const bob = await createTestUser({ email: 'bob-complete@phinio.test' })

    const aliceEmi = await callerFor(alice.profileId).emis.create({
      label: 'Alice loan',
      type: 'bank_loan',
      principal: '30000',
      interestRate: '12',
      tenureMonths: 3,
      startDate: '2026-01-01',
    })

    await expect(
      callerFor(bob.profileId).emis.complete({ emiId: aliceEmi.id }),
    ).rejects.toThrow(/not found/i)

    const reloaded = await prisma.emi.findUniqueOrThrow({
      where: { id: aliceEmi.id },
    })
    expect(reloaded.status).toBe('active')
  })

  it('upcomingPaymentsImpl returns at most 5 unpaid payments sorted by dueDate asc', async () => {
    const user = await createTestUser({ email: 'upcoming@phinio.test' })

    // Start date = tomorrow so the first payment is always in the future,
    // regardless of what time of day the test runs (avoids the midnight-UTC
    // boundary where "today" at 00:00 UTC is already in the past).
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const yyyy = tomorrow.getFullYear()
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const dd = String(tomorrow.getDate()).padStart(2, '0')
    const startDate = `${yyyy}-${mm}-${dd}`

    await callerFor(user.profileId).emis.create({
      label: 'Upcoming loan',
      type: 'bank_loan',
      principal: '120000',
      interestRate: '12',
      tenureMonths: 12,
      startDate,
    })

    const rows = await callerFor(user.profileId).emis.upcomingPayments()

    expect(rows.length).toBeLessThanOrEqual(5)
    for (const r of rows) {
      expect(r.isOverdue).toBe(false)
    }
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].dueDate.getTime()).toBeGreaterThanOrEqual(
        rows[i - 1].dueDate.getTime(),
      )
    }
  })
})
