import { beforeEach, describe, expect, it } from 'vitest'
import {
  diffFields,
  fmtDate,
  fmtMoney,
  fmtText,
  listActivityImpl,
  logActivity,
} from '#/server/activity-log.impl'
import {
  createDpsInvestmentImpl,
  createInvestmentImpl,
  markDepositPaidImpl,
  updateInvestmentImpl,
} from '#/server/investments.impl'
import { createTestUser, prisma, resetDb } from './helpers/db'

beforeEach(async () => {
  await resetDb()
})

// ---------------------------------------------------------------------------
// Pure helpers — fmtMoney, fmtDate, fmtText, diffFields
// ---------------------------------------------------------------------------

describe('fmtMoney', () => {
  it('returns null for null and undefined', () => {
    expect(fmtMoney(null)).toBeNull()
    expect(fmtMoney(undefined)).toBeNull()
  })

  it('formats strings with 2 decimals', () => {
    expect(fmtMoney('1000')).toBe('1000.00')
    expect(fmtMoney('1000.5')).toBe('1000.50')
  })

  it('formats numbers with 2 decimals', () => {
    expect(fmtMoney(42)).toBe('42.00')
  })

  it('preserves precision for large decimals beyond JS safe integer range', () => {
    // 9999999999999.99 is within Decimal(15,2) and within JS safe int range,
    // but the Decimal path is what keeps cents intact regardless.
    expect(fmtMoney('9999999999999.99')).toBe('9999999999999.99')
  })

  it('falls back to String(v) for unparseable input', () => {
    expect(fmtMoney('not-a-number')).toBe('not-a-number')
  })
})

describe('fmtDate', () => {
  it('returns null for null and undefined', () => {
    expect(fmtDate(null)).toBeNull()
    expect(fmtDate(undefined)).toBeNull()
  })

  it('slices a Date to YYYY-MM-DD', () => {
    expect(fmtDate(new Date('2026-04-19T12:34:56Z'))).toBe('2026-04-19')
  })

  it('accepts an ISO string', () => {
    expect(fmtDate('2026-01-02T00:00:00Z')).toBe('2026-01-02')
  })
})

describe('fmtText', () => {
  it('trims whitespace', () => {
    expect(fmtText('  hi  ')).toBe('hi')
  })

  it('maps empty and whitespace-only to null', () => {
    expect(fmtText('')).toBeNull()
    expect(fmtText('   ')).toBeNull()
  })
})

describe('diffFields', () => {
  it('returns only changed entries, preserving spec order', () => {
    const before = { name: 'A', notes: 'old', amount: '100.00' }
    const after = { name: 'B', notes: 'old', amount: '150.00' }
    const changes = diffFields(before, after, [
      { key: 'amount', label: 'Amount', isMoney: true },
      { key: 'name', label: 'Name', format: fmtText },
      { key: 'notes', label: 'Notes', format: fmtText },
    ])
    expect(changes.map((c) => c.field)).toEqual(['Amount', 'Name'])
  })

  it('skips fields that are not present in `after`', () => {
    const before = { name: 'A', notes: 'keep' }
    const after = { name: 'B' }
    const changes = diffFields(before, after, [
      { key: 'name', label: 'Name', format: fmtText },
      { key: 'notes', label: 'Notes', format: fmtText },
    ])
    expect(changes).toHaveLength(1)
    expect(changes[0].field).toBe('Name')
  })

  it('attaches currency to money-field changes when passed', () => {
    const before = { amount: '100' }
    const after = { amount: '200' }
    const changes = diffFields(
      before,
      after,
      [{ key: 'amount', label: 'Amount', isMoney: true }],
      'USD',
    )
    expect(changes[0]).toMatchObject({
      field: 'Amount',
      from: '100.00',
      to: '200.00',
      currency: 'USD',
    })
  })

  it('omits currency when isMoney is true but currency arg is not passed', () => {
    const before = { amount: '100' }
    const after = { amount: '200' }
    const changes = diffFields(before, after, [
      { key: 'amount', label: 'Amount', isMoney: true },
    ])
    expect(changes[0]).not.toHaveProperty('currency')
  })
})

// ---------------------------------------------------------------------------
// Roundtrip — logActivity + listActivityImpl
// ---------------------------------------------------------------------------

describe('activity log roundtrip', () => {
  it('logActivity persists a row that listActivityImpl returns', async () => {
    const user = await createTestUser()

    await logActivity(prisma, user.profileId, {
      action: 'create',
      entityType: 'investment',
      entityId: 'inv_1',
      entityLabel: 'Apple',
      summary: "Created investment 'Apple'",
    })

    const result = await listActivityImpl(user.profileId, {})
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      action: 'create',
      entityType: 'investment',
      entityId: 'inv_1',
      entityLabel: 'Apple',
      summary: "Created investment 'Apple'",
      changes: null,
    })
    expect(result.nextCursor).toBeNull()
  })

  it('scopes results to the caller profile', async () => {
    const alice = await createTestUser({ email: 'alice@phinio.test' })
    const bob = await createTestUser({ email: 'bob@phinio.test' })

    await logActivity(prisma, alice.profileId, {
      action: 'create',
      entityType: 'investment',
      entityId: 'a',
      entityLabel: 'Alice inv',
      summary: 'alice',
    })
    await logActivity(prisma, bob.profileId, {
      action: 'create',
      entityType: 'investment',
      entityId: 'b',
      entityLabel: 'Bob inv',
      summary: 'bob',
    })

    const aliceRows = await listActivityImpl(alice.profileId, {})
    expect(aliceRows.items).toHaveLength(1)
    expect(aliceRows.items[0].summary).toBe('alice')
  })

  it('paginates via the returned cursor', async () => {
    const user = await createTestUser()

    for (let i = 0; i < 5; i++) {
      await logActivity(prisma, user.profileId, {
        action: 'create',
        entityType: 'investment',
        entityId: `e${i}`,
        entityLabel: `E${i}`,
        summary: `s${i}`,
      })
    }

    const first = await listActivityImpl(user.profileId, { limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()

    const second = await listActivityImpl(user.profileId, {
      limit: 2,
      cursor: first.nextCursor,
    })
    expect(second.items).toHaveLength(2)

    const third = await listActivityImpl(user.profileId, {
      limit: 2,
      cursor: second.nextCursor,
    })
    expect(third.items).toHaveLength(1)
    expect(third.nextCursor).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Wired through a real mutation — the diff should include currency on money
// fields so the UI can render the symbol that was active at the time of edit.
// ---------------------------------------------------------------------------

describe('investment mutations emit log rows with currency-tagged money diffs', () => {
  it('update records currency on money-field changes', async () => {
    const user = await createTestUser({ preferredCurrency: 'BDT' })

    const created = await createInvestmentImpl(user.profileId, {
      name: 'Apple',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
      dateOfInvestment: '2026-01-15',
    })

    await updateInvestmentImpl(user.profileId, {
      id: created.id,
      name: 'Apple Inc',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1500.00',
      dateOfInvestment: '2026-01-15',
      status: 'active',
    })

    const { items } = await listActivityImpl(user.profileId, {})
    // Most recent first — update row leads.
    const updateRow = items.find((r) => r.action === 'update')
    expect(updateRow).toBeTruthy()
    const changes = updateRow!.changes ?? []
    const currentValueChange = changes.find((c) => c.field === 'Current value')
    expect(currentValueChange).toMatchObject({
      from: '1200.00',
      to: '1500.00',
      currency: 'BDT',
    })
    const nameChange = changes.find((c) => c.field === 'Name')
    expect(nameChange).toMatchObject({ from: 'Apple', to: 'Apple Inc' })
    expect(nameChange).not.toHaveProperty('currency')
  })

  it('update does not log when nothing changed', async () => {
    const user = await createTestUser()

    const created = await createInvestmentImpl(user.profileId, {
      name: 'Apple',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
      dateOfInvestment: '2026-01-15',
    })

    await updateInvestmentImpl(user.profileId, {
      id: created.id,
      name: 'Apple',
      type: 'stock',
      investedAmount: '1000.00',
      currentValue: '1200.00',
      dateOfInvestment: '2026-01-15',
      status: 'active',
    })

    const { items } = await listActivityImpl(user.profileId, {})
    // Only the create log should exist — the no-op update must not emit a row.
    expect(items.filter((r) => r.action === 'update')).toHaveLength(0)
    expect(items.filter((r) => r.action === 'create')).toHaveLength(1)
  })
})

describe('markDepositPaidImpl DPS status transitions', () => {
  it('reactivates a matured DPS when an installment is unmarked', async () => {
    const user = await createTestUser()

    const dps = await createDpsInvestmentImpl(user.profileId, {
      name: 'Short DPS',
      monthlyDeposit: '100.00',
      tenureMonths: 2,
      interestRate: '0',
      interestType: 'simple',
      startDate: '2026-01-01',
    })

    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: dps.id },
      orderBy: { installmentNumber: 'asc' },
    })
    expect(deposits).toHaveLength(2)

    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[0].id,
      paid: true,
    })
    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[1].id,
      paid: true,
    })

    let inv = await prisma.investment.findUniqueOrThrow({
      where: { id: dps.id },
    })
    expect(inv.status).toBe('matured')

    await markDepositPaidImpl(user.profileId, {
      depositId: deposits[1].id,
      paid: false,
    })

    inv = await prisma.investment.findUniqueOrThrow({ where: { id: dps.id } })
    expect(inv.status).toBe('active')

    const { items } = await listActivityImpl(user.profileId, {})
    expect(items.some((r) => r.summary.includes('reactivated'))).toBe(true)
  })
})
