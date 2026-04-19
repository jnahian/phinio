import { beforeEach, describe, expect, it } from 'vitest'
import {
  createInvestmentImpl,
  deleteInvestmentImpl,
  getInvestmentImpl,
  listInvestmentsImpl,
  updateInvestmentImpl,
  createDpsInvestmentImpl,
  updateDpsInvestmentImpl,
  markDepositPaidImpl,
  createSavingsInvestmentImpl,
  updateSavingsInvestmentImpl,
  addDepositImpl,
  removeDepositImpl,
  withdrawImpl,
  closeDpsImpl,
} from '#/server/investments.impl'
import { createTestUser, prisma, resetDb } from './helpers/db'

beforeEach(async () => {
  await resetDb()
})

// ---------------------------------------------------------------------------
// Lump-sum (mode: lump_sum)
// ---------------------------------------------------------------------------

describe('lump-sum investments', () => {
  it('creates an investment scoped to the current profile', async () => {
    const user = await createTestUser()

    const created = await createInvestmentImpl(user.profileId, {
      name: 'Apple',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
      dateOfInvestment: '2026-01-15',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.name).toBe('Apple')
    expect(inv.investedAmount).toBe('1000')
    expect(inv.currentValue).toBe('1200')
    expect(inv.mode).toBe('lump_sum')
    expect(inv.status).toBe('active')
  })

  it("lists only the current profile's investments (profileId scoping)", async () => {
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

  it("refuses updates and deletes to another profile's investment", async () => {
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

    await updateInvestmentImpl(user.profileId, {
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

    const updated = await getInvestmentImpl(user.profileId, inv.id)
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

// ---------------------------------------------------------------------------
// DPS (mode: scheduled)
// ---------------------------------------------------------------------------

describe('DPS (scheduled) investments', () => {
  it('createDpsInvestmentImpl generates the full deposit schedule up front', async () => {
    const user = await createTestUser()

    const created = await createDpsInvestmentImpl(user.profileId, {
      name: 'My DPS',
      monthlyDeposit: '5000.00',
      tenureMonths: 12,
      interestRate: '8.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    const count = await prisma.investmentDeposit.count({
      where: { investmentId: created.id },
    })
    expect(count).toBe(12)
  })

  it('deposits start as upcoming with correct amount and installment numbers', async () => {
    const user = await createTestUser()

    const created = await createDpsInvestmentImpl(user.profileId, {
      name: 'Ordered DPS',
      monthlyDeposit: '3000.00',
      tenureMonths: 3,
      interestRate: '7.50',
      interestType: 'compound',
      startDate: '2026-01-01',
    })

    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: created.id },
      orderBy: { installmentNumber: 'asc' },
    })

    expect(deposits).toHaveLength(3)
    deposits.forEach((d, i) => {
      expect(d.installmentNumber).toBe(i + 1)
      expect(d.status).toBe('upcoming')
      expect(String(d.amount)).toBe('3000')
    })
  })

  it('investedAmount starts at 0 and is synced when deposits are paid', async () => {
    const user = await createTestUser()

    const created = await createDpsInvestmentImpl(user.profileId, {
      name: 'DPS Sync',
      monthlyDeposit: '2000.00',
      tenureMonths: 6,
      interestRate: '8.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    // investedAmount should start at 0
    const before = await getInvestmentImpl(user.profileId, created.id)
    expect(before.investedAmount).toBe('0')

    // Mark the first deposit paid
    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: created.id },
      orderBy: { installmentNumber: 'asc' },
    })
    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[0].id,
      paid: true,
    })

    // investedAmount should now equal one monthly deposit
    const after = await getInvestmentImpl(user.profileId, created.id)
    expect(after.investedAmount).toBe('2000')
    expect(after.currentValue).toBe('2000')

    // Mark second deposit paid too
    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[1].id,
      paid: true,
    })
    const after2 = await getInvestmentImpl(user.profileId, created.id)
    expect(after2.investedAmount).toBe('4000')
  })

  it('markDepositPaidImpl toggles a deposit back to upcoming and re-syncs amount', async () => {
    const user = await createTestUser()

    const created = await createDpsInvestmentImpl(user.profileId, {
      name: 'Toggle DPS',
      monthlyDeposit: '1000.00',
      tenureMonths: 3,
      interestRate: '0',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: created.id },
      orderBy: { installmentNumber: 'asc' },
    })

    // Pay two deposits
    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[0].id,
      paid: true,
    })
    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[1].id,
      paid: true,
    })

    const twoIn = await getInvestmentImpl(user.profileId, created.id)
    expect(twoIn.investedAmount).toBe('2000')

    // Unpay the second
    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[1].id,
      paid: false,
    })

    const oneIn = await getInvestmentImpl(user.profileId, created.id)
    expect(oneIn.investedAmount).toBe('1000')

    const toggled = await prisma.investmentDeposit.findUniqueOrThrow({
      where: { id: deposits[1].id },
    })
    expect(toggled.status).toBe('upcoming')
    expect(toggled.paidAt).toBeNull()
  })

  it('auto-matures the investment when all deposits are paid', async () => {
    const user = await createTestUser()

    const created = await createDpsInvestmentImpl(user.profileId, {
      name: 'Short DPS',
      monthlyDeposit: '500.00',
      tenureMonths: 2,
      interestRate: '5.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: created.id },
    })

    for (const d of deposits) {
      await markDepositPaidImpl(user.profileId, { depositId: d.id, paid: true })
    }

    const matured = await getInvestmentImpl(user.profileId, created.id)
    expect(matured.status).toBe('matured')
  })

  it('markDepositPaidImpl refuses cross-profile updates', async () => {
    const alice = await createTestUser({ email: 'alice-dps@phinio.test' })
    const bob = await createTestUser({ email: 'bob-dps@phinio.test' })

    const created = await createDpsInvestmentImpl(alice.profileId, {
      name: 'Alice DPS',
      monthlyDeposit: '1000.00',
      tenureMonths: 3,
      interestRate: '8.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    const deposit = await prisma.investmentDeposit.findFirstOrThrow({
      where: { investmentId: created.id, installmentNumber: 1 },
    })

    await expect(
      markDepositPaidImpl(bob.profileId, { depositId: deposit.id, paid: true }),
    ).rejects.toThrow(/not found/i)

    const unchanged = await prisma.investmentDeposit.findUniqueOrThrow({
      where: { id: deposit.id },
    })
    expect(unchanged.status).toBe('upcoming')
  })

  it('updateDpsInvestmentImpl updates name and notes only', async () => {
    const user = await createTestUser()

    const created = await createDpsInvestmentImpl(user.profileId, {
      name: 'Original Name',
      monthlyDeposit: '2000.00',
      tenureMonths: 6,
      interestRate: '8.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    await updateDpsInvestmentImpl(user.profileId, {
      id: created.id,
      name: 'Renamed DPS',
      notes: 'Updated note',
    })

    const updated = await getInvestmentImpl(user.profileId, created.id)
    expect(updated.name).toBe('Renamed DPS')
    expect(updated.notes).toBe('Updated note')
    // Core financial fields unchanged
    expect(updated.monthlyDeposit).toBe('2000')
    expect(updated.tenureMonths).toBe(6)
  })

  it('filters the list by DPS type', async () => {
    const user = await createTestUser()

    await createInvestmentImpl(user.profileId, {
      name: 'My Stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })
    await createDpsInvestmentImpl(user.profileId, {
      name: 'My DPS',
      monthlyDeposit: '3000.00',
      tenureMonths: 12,
      interestRate: '8.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    const dpsOnly = await listInvestmentsImpl(user.profileId, {
      status: 'active',
      type: 'dps',
    })
    expect(dpsOnly).toHaveLength(1)
    expect(dpsOnly[0].name).toBe('My DPS')
    expect(dpsOnly[0].mode).toBe('scheduled')
  })

  it('list exposes paidCount and nextDueDate for DPS cards', async () => {
    const user = await createTestUser()

    const created = await createDpsInvestmentImpl(user.profileId, {
      name: 'DPS List Info',
      monthlyDeposit: '1000.00',
      tenureMonths: 3,
      interestRate: '6.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: created.id },
      orderBy: { installmentNumber: 'asc' },
    })

    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[0].id,
      paid: true,
    })

    const rows = await listInvestmentsImpl(user.profileId, {
      status: 'active',
      type: 'dps',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].paidCount).toBe(1)
    expect(rows[0].nextDueDate).toEqual(deposits[1].dueDate)
  })
})

// ---------------------------------------------------------------------------
// Savings (mode: flexible)
// ---------------------------------------------------------------------------

describe('savings pot (flexible) investments', () => {
  it('createSavingsInvestmentImpl with currentValue=0 creates an empty pot', async () => {
    const user = await createTestUser()

    const created = await createSavingsInvestmentImpl(user.profileId, {
      name: 'Empty Fund',
      startDate: '2026-01-01',
      currentValue: '0',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.name).toBe('Empty Fund')
    expect(inv.mode).toBe('flexible')
    expect(inv.type).toBe('savings')
    expect(inv.investedAmount).toBe('0')
    expect(inv.currentValue).toBe('0')
    // No initial deposit row is created when starting at 0.
    expect(inv.deposits).toHaveLength(0)
  })

  it('createSavingsInvestmentImpl with non-zero currentValue seeds an "Initial deposit"', async () => {
    const user = await createTestUser()

    const created = await createSavingsInvestmentImpl(user.profileId, {
      name: 'Emergency Fund',
      startDate: '2026-01-01',
      currentValue: '50000.00',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.name).toBe('Emergency Fund')
    expect(inv.mode).toBe('flexible')
    expect(inv.type).toBe('savings')
    // Sync feature (commit 9d24138): non-zero starting balance creates a
    // matching deposit row, so investedAmount tracks the synced total.
    expect(inv.investedAmount).toBe('50000')
    expect(inv.currentValue).toBe('50000')
    expect(inv.deposits).toHaveLength(1)
    expect(inv.deposits[0].amount).toBe('50000')
    expect(inv.deposits[0].notes).toBe('Initial deposit')
    expect(inv.deposits[0].status).toBe('paid')
  })

  it('addDepositImpl creates a deposit row and syncs investedAmount', async () => {
    const user = await createTestUser()

    const created = await createSavingsInvestmentImpl(user.profileId, {
      name: 'Vacation Fund',
      startDate: '2026-01-01',
      currentValue: '0',
    })

    await addDepositImpl(user.profileId, {
      investmentId: created.id,
      amount: '10000.00',
      depositDate: '2026-02-01',
      notes: 'First deposit',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.investedAmount).toBe('10000')
    expect(inv.deposits).toHaveLength(1)
    expect(inv.deposits[0].status).toBe('paid')
    expect(inv.deposits[0].notes).toBe('First deposit')
  })

  it('addDepositImpl accumulates investedAmount across multiple deposits', async () => {
    const user = await createTestUser()

    const created = await createSavingsInvestmentImpl(user.profileId, {
      name: 'Multi deposit pot',
      startDate: '2026-01-01',
      currentValue: '0',
    })

    await addDepositImpl(user.profileId, {
      investmentId: created.id,
      amount: '5000.00',
      depositDate: '2026-01-15',
    })
    await addDepositImpl(user.profileId, {
      investmentId: created.id,
      amount: '3000.00',
      depositDate: '2026-02-15',
    })
    await addDepositImpl(user.profileId, {
      investmentId: created.id,
      amount: '2000.00',
      depositDate: '2026-03-15',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.investedAmount).toBe('10000')
    expect(inv.deposits).toHaveLength(3)
  })

  it('removeDepositImpl deletes the deposit and re-syncs investedAmount', async () => {
    const user = await createTestUser()

    const created = await createSavingsInvestmentImpl(user.profileId, {
      name: 'Remove test pot',
      startDate: '2026-01-01',
      currentValue: '0',
    })

    await addDepositImpl(user.profileId, {
      investmentId: created.id,
      amount: '8000.00',
      depositDate: '2026-01-01',
    })
    await addDepositImpl(user.profileId, {
      investmentId: created.id,
      amount: '2000.00',
      depositDate: '2026-02-01',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.investedAmount).toBe('10000')

    const secondDeposit = inv.deposits.find((d) => String(d.amount) === '2000')!

    await removeDepositImpl(user.profileId, { depositId: secondDeposit.id })

    const afterRemove = await getInvestmentImpl(user.profileId, created.id)
    expect(afterRemove.investedAmount).toBe('8000')
    expect(afterRemove.deposits).toHaveLength(1)
  })

  it('removeDepositImpl refuses cross-profile removal', async () => {
    const alice = await createTestUser({ email: 'alice-sav@phinio.test' })
    const bob = await createTestUser({ email: 'bob-sav@phinio.test' })

    const created = await createSavingsInvestmentImpl(alice.profileId, {
      name: 'Alice pot',
      startDate: '2026-01-01',
      currentValue: '0',
    })

    await addDepositImpl(alice.profileId, {
      investmentId: created.id,
      amount: '5000.00',
      depositDate: '2026-01-01',
    })

    const deposit = await prisma.investmentDeposit.findFirstOrThrow({
      where: { investmentId: created.id },
    })

    await expect(
      removeDepositImpl(bob.profileId, { depositId: deposit.id }),
    ).rejects.toThrow(/not found/i)

    // Deposit still intact
    const stillThere = await getInvestmentImpl(alice.profileId, created.id)
    expect(stillThere.investedAmount).toBe('5000')
  })

  it('updateSavingsInvestmentImpl updates name and currentValue', async () => {
    const user = await createTestUser()

    const created = await createSavingsInvestmentImpl(user.profileId, {
      name: 'Old Name',
      startDate: '2026-01-01',
      currentValue: '20000.00',
    })

    await updateSavingsInvestmentImpl(user.profileId, {
      id: created.id,
      name: 'New Name',
      currentValue: '22000.00',
    })

    const updated = await getInvestmentImpl(user.profileId, created.id)
    expect(updated.name).toBe('New Name')
    expect(updated.currentValue).toBe('22000')
  })

  it('filters the list by savings type', async () => {
    const user = await createTestUser()

    await createInvestmentImpl(user.profileId, {
      name: 'My Stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })
    await createSavingsInvestmentImpl(user.profileId, {
      name: 'My Savings',
      startDate: '2026-01-01',
      currentValue: '0',
    })

    const savingsOnly = await listInvestmentsImpl(user.profileId, {
      status: 'active',
      type: 'savings',
    })
    expect(savingsOnly).toHaveLength(1)
    expect(savingsOnly[0].name).toBe('My Savings')
    expect(savingsOnly[0].mode).toBe('flexible')
  })
})

// ---------------------------------------------------------------------------
// Withdrawals (withdrawImpl + closeDpsImpl)
// ---------------------------------------------------------------------------

describe('withdrawals', () => {
  it('partial lump-sum withdrawal reduces currentValue, preserves investedAmount, logs row', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Apple',
      type: 'stock',
      investedAmount: '10000.00',
      currentValue: '12000.00',
      dateOfInvestment: '2026-01-01',
    })

    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '3000.00',
      withdrawalDate: '2026-03-01',
      notes: 'partial sale',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.investedAmount).toBe('10000')
    expect(inv.currentValue).toBe('9000')
    expect(inv.status).toBe('active')
    expect(inv.exitValue).toBeNull()
    expect(inv.withdrawals).toHaveLength(1)
    expect(inv.withdrawals[0].amount).toBe('3000')
    expect(inv.withdrawals[0].notes).toBe('partial sale')
  })

  it('full lump-sum withdrawal with closeInvestment closes the investment and sets exitValue', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Gold bar',
      type: 'gold',
      investedAmount: '5000.00',
      currentValue: '5500.00',
      dateOfInvestment: '2026-01-01',
    })

    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '5500.00',
      withdrawalDate: '2026-04-10',
      closeInvestment: true,
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.status).toBe('completed')
    expect(inv.currentValue).toBe('0')
    expect(inv.exitValue).toBe('5500')
    expect(inv.completedAt).toBeInstanceOf(Date)
  })

  it('list view exposes exitValue==totalWithdrawn for withdrawal-closed items (UI must not double-add)', async () => {
    // Pins the invariant the InvestmentCard / totals summary rely on:
    // when an investment is closed via withdrawal, exitValue equals
    // totalWithdrawn (currentValue is zero). The list-page ROI numerator
    // uses exitValue alone for completed items; if it added totalWithdrawn
    // the realized proceeds would be counted twice.
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Stock',
      type: 'stock',
      investedAmount: '10000.00',
      currentValue: '10000.00',
      dateOfInvestment: '2026-01-01',
    })
    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '10000.00',
      withdrawalDate: '2026-04-10',
      closeInvestment: true,
    })

    const [row] = await listInvestmentsImpl(user.profileId, {
      status: 'completed',
      type: 'all',
    })
    expect(row.status).toBe('completed')
    expect(row.currentValue).toBe('0')
    expect(row.exitValue).toBe('10000')
    expect(row.totalWithdrawn).toBe('10000.00')
    // Sanity: the correct ROI numerator is exitValue alone — equal to
    // invested for a break-even close, NOT exitValue + totalWithdrawn.
    expect(Number(row.exitValue)).toBe(Number(row.investedAmount))
  })

  it('savings (flexible) partial withdrawal mirrors lump-sum behavior', async () => {
    const user = await createTestUser()
    const pot = await createSavingsInvestmentImpl(user.profileId, {
      name: 'Emergency fund',
      startDate: '2026-01-01',
      currentValue: '10000.00',
    })

    await withdrawImpl(user.profileId, {
      investmentId: pot.id,
      amount: '3000.00',
      withdrawalDate: '2026-02-15',
    })

    const inv = await getInvestmentImpl(user.profileId, pot.id)
    expect(inv.investedAmount).toBe('10000') // preserved (deposits unchanged)
    expect(inv.currentValue).toBe('7000')
    expect(inv.status).toBe('active')
    expect(inv.withdrawals).toHaveLength(1)
  })

  it('rejects a withdrawal amount that exceeds currentValue', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })

    await expect(
      withdrawImpl(user.profileId, {
        investmentId: created.id,
        amount: '1500.00',
        withdrawalDate: '2026-02-01',
      }),
    ).rejects.toThrow(/exceeds/i)

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.currentValue).toBe('1000') // untouched
    expect(inv.withdrawals).toHaveLength(0)
  })

  it('rejects withdrawImpl on a DPS (scheduled) investment — must use closeDpsImpl', async () => {
    const user = await createTestUser()
    const dps = await createDpsInvestmentImpl(user.profileId, {
      name: 'Bank DPS',
      monthlyDeposit: '1000.00',
      tenureMonths: 12,
      interestRate: '8.00',
      interestType: 'compound',
      startDate: '2026-01-01',
    })

    await expect(
      withdrawImpl(user.profileId, {
        investmentId: dps.id,
        amount: '500.00',
        withdrawalDate: '2026-02-01',
      }),
    ).rejects.toThrow(/premature closure/i)
  })

  it('rejects withdrawals on a non-active investment', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })
    // Close it via a full withdrawal first
    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '1000.00',
      withdrawalDate: '2026-02-01',
      closeInvestment: true,
    })

    await expect(
      withdrawImpl(user.profileId, {
        investmentId: created.id,
        amount: '100.00',
        withdrawalDate: '2026-03-01',
      }),
    ).rejects.toThrow(/not active/i)
  })

  it("refuses withdrawals against another profile's investment", async () => {
    const alice = await createTestUser({ email: 'alice@phinio.test' })
    const bob = await createTestUser({ email: 'bob@phinio.test' })
    const aliceInv = await createInvestmentImpl(alice.profileId, {
      name: 'Alice stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })

    await expect(
      withdrawImpl(bob.profileId, {
        investmentId: aliceInv.id,
        amount: '100.00',
        withdrawalDate: '2026-02-01',
      }),
    ).rejects.toThrow(/not found/i)
  })

  it('closeDpsImpl deletes upcoming installments, keeps paid ones, sets exitValue', async () => {
    const user = await createTestUser()
    const dps = await createDpsInvestmentImpl(user.profileId, {
      name: 'Bank DPS',
      monthlyDeposit: '1000.00',
      tenureMonths: 12,
      interestRate: '8.00',
      interestType: 'compound',
      startDate: '2026-01-01',
    })

    // Pay the first 4 installments
    const before = await getInvestmentImpl(user.profileId, dps.id)
    for (const dep of before.deposits.slice(0, 4)) {
      await markDepositPaidImpl(user.profileId, {
        depositId: dep.id,
        paid: true,
      })
    }

    await closeDpsImpl(user.profileId, {
      investmentId: dps.id,
      receivedAmount: '3950.00',
      closureDate: '2026-05-15',
      notes: 'switched bank',
    })

    const inv = await getInvestmentImpl(user.profileId, dps.id)
    expect(inv.status).toBe('closed')
    expect(inv.currentValue).toBe('0')
    expect(inv.exitValue).toBe('3950')
    expect(inv.completedAt).toBeInstanceOf(Date)
    // Only the 4 paid installments remain
    expect(inv.deposits).toHaveLength(4)
    expect(inv.deposits.every((d) => d.status === 'paid')).toBe(true)
    expect(inv.withdrawals).toHaveLength(1)
    expect(inv.withdrawals[0].amount).toBe('3950')
    expect(inv.withdrawals[0].notes).toMatch(/Premature closure/)
  })

  it('closeDpsImpl rejects non-DPS investments', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })

    await expect(
      closeDpsImpl(user.profileId, {
        investmentId: created.id,
        receivedAmount: '500.00',
        closureDate: '2026-02-01',
      }),
    ).rejects.toThrow(/DPS not found/i)
  })

  it('closeDpsImpl rejects an already-closed DPS', async () => {
    const user = await createTestUser()
    const dps = await createDpsInvestmentImpl(user.profileId, {
      name: 'DPS',
      monthlyDeposit: '500.00',
      tenureMonths: 6,
      interestRate: '5.00',
      interestType: 'simple',
      startDate: '2026-01-01',
    })
    await closeDpsImpl(user.profileId, {
      investmentId: dps.id,
      receivedAmount: '100.00',
      closureDate: '2026-02-01',
    })

    await expect(
      closeDpsImpl(user.profileId, {
        investmentId: dps.id,
        receivedAmount: '50.00',
        closureDate: '2026-03-01',
      }),
    ).rejects.toThrow(/not active/i)
  })

  it('listInvestmentsImpl returns totalWithdrawn summed across the table', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Stock',
      type: 'stock',
      investedAmount: '5000.00',
      currentValue: '5000.00',
      dateOfInvestment: '2026-01-01',
    })

    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '1000.00',
      withdrawalDate: '2026-02-01',
    })
    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '500.00',
      withdrawalDate: '2026-03-01',
    })

    const rows = await listInvestmentsImpl(user.profileId, {
      status: 'active',
      type: 'all',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].totalWithdrawn).toBe('1500.00')
    expect(rows[0].currentValue).toBe('3500')
  })

  it('getInvestmentImpl returns withdrawals sorted by date desc', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Stock',
      type: 'stock',
      investedAmount: '5000.00',
      currentValue: '5000.00',
      dateOfInvestment: '2026-01-01',
    })

    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '500.00',
      withdrawalDate: '2026-02-01',
    })
    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '300.00',
      withdrawalDate: '2026-04-01',
    })
    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '200.00',
      withdrawalDate: '2026-03-01',
    })

    const inv = await getInvestmentImpl(user.profileId, created.id)
    expect(inv.withdrawals.map((w) => w.amount)).toEqual(['300', '200', '500'])
  })

  it('cascades: deleting the investment removes its withdrawal rows', async () => {
    const user = await createTestUser()
    const created = await createInvestmentImpl(user.profileId, {
      name: 'Stock',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1000.00',
      dateOfInvestment: '2026-01-01',
    })
    await withdrawImpl(user.profileId, {
      investmentId: created.id,
      amount: '200.00',
      withdrawalDate: '2026-02-01',
    })
    await deleteInvestmentImpl(user.profileId, created.id)

    const remaining = await prisma.investmentWithdrawal.count({
      where: { investmentId: created.id },
    })
    expect(remaining).toBe(0)
  })
})
