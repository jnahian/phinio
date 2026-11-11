import { beforeEach, describe, expect, it } from 'vitest'
import {
  addLoanRepaymentImpl,
  createPersonalLoanImpl,
  deletePersonalLoanImpl,
  getPersonalLoanImpl,
  listPersonalLoansImpl,
  removeLoanRepaymentImpl,
  updatePersonalLoanImpl,
} from '#/server/personal-loans.impl'
import { createTestUser, prisma, resetDb } from './helpers/db'

beforeEach(async () => {
  await resetDb()
})

const baseLoan = {
  direction: 'borrowed' as const,
  counterparty: 'Rafiq',
  principal: '50000',
  startDate: '2026-01-15',
}

describe('personal loans server impls', () => {
  it('creates a loan with outstanding equal to the principal', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, baseLoan)

    const loan = await getPersonalLoanImpl(user.profileId, id)
    expect(loan).toMatchObject({
      direction: 'borrowed',
      counterparty: 'Rafiq',
      principal: '50000.00',
      totalRepayable: null,
      totalDue: '50000.00',
      repaid: '0.00',
      outstanding: '50000.00',
      status: 'active',
    })
    expect(loan.repayments).toEqual([])
  })

  it('uses the agreed total when one is given, and stores a total equal to the principal as null', async () => {
    const user = await createTestUser()
    const withExtra = await createPersonalLoanImpl(user.profileId, {
      ...baseLoan,
      totalRepayable: '55000',
    })
    const sameAsPrincipal = await createPersonalLoanImpl(user.profileId, {
      ...baseLoan,
      totalRepayable: '50000.00',
    })

    const a = await getPersonalLoanImpl(user.profileId, withExtra.id)
    expect(a.totalRepayable).toBe('55000.00')
    expect(a.outstanding).toBe('55000.00')

    const b = await getPersonalLoanImpl(user.profileId, sameAsPrincipal.id)
    expect(b.totalRepayable).toBeNull()
    expect(b.outstanding).toBe('50000.00')
  })

  it('reduces outstanding with each repayment and lists them newest first', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, baseLoan)

    await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '5000',
      paidAt: '2026-02-01',
    })
    await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '12000.50',
      paidAt: '2026-03-10',
      notes: 'bKash',
    })

    const loan = await getPersonalLoanImpl(user.profileId, id)
    expect(loan.repaid).toBe('17000.50')
    expect(loan.outstanding).toBe('32999.50')
    expect(loan.status).toBe('active')
    expect(loan.repayments.map((r) => r.amount)).toEqual([
      '12000.50',
      '5000.00',
    ])
    expect(loan.repayments[0].notes).toBe('bKash')
  })

  it('rejects a repayment larger than what is still owed', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, baseLoan)
    await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '45000',
      paidAt: '2026-02-01',
    })

    await expect(
      addLoanRepaymentImpl(user.profileId, {
        loanId: id,
        amount: '5000.01',
        paidAt: '2026-03-01',
      }),
    ).rejects.toThrow(/more than the 5000.00 still owed/)

    const count = await prisma.personalLoanRepayment.count({
      where: { loanId: id },
    })
    expect(count).toBe(1)
  })

  it('settles the loan when the final amount is repaid, and reopens it when a repayment is removed', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, {
      ...baseLoan,
      direction: 'lent',
      principal: '1000',
    })

    const first = await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '400',
      paidAt: '2026-02-01',
    })
    expect(first.settled).toBe(false)
    const last = await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '600',
      paidAt: '2026-03-01',
    })
    expect(last.settled).toBe(true)
    expect((await getPersonalLoanImpl(user.profileId, id)).status).toBe(
      'settled',
    )

    const removed = await removeLoanRepaymentImpl(user.profileId, {
      repaymentId: first.id,
    })
    expect(removed.reopened).toBe(true)
    const loan = await getPersonalLoanImpl(user.profileId, id)
    expect(loan.status).toBe('active')
    expect(loan.outstanding).toBe('400.00')
  })

  it('filters the list by status', async () => {
    const user = await createTestUser()
    await createPersonalLoanImpl(user.profileId, baseLoan)
    await createPersonalLoanImpl(user.profileId, {
      ...baseLoan,
      direction: 'lent',
      counterparty: 'Karim',
    })
    const settled = await createPersonalLoanImpl(user.profileId, {
      ...baseLoan,
      counterparty: 'Paid off',
      principal: '100',
    })
    await addLoanRepaymentImpl(user.profileId, {
      loanId: settled.id,
      amount: '100',
      paidAt: '2026-02-01',
    })

    const active = await listPersonalLoansImpl(user.profileId, {
      status: 'active',
    })
    expect(active.map((l) => l.counterparty).sort()).toEqual(['Karim', 'Rafiq'])

    const settledList = await listPersonalLoansImpl(user.profileId, {
      status: 'settled',
    })
    expect(settledList.map((l) => l.counterparty)).toEqual(['Paid off'])
    expect(settledList[0].outstanding).toBe('0.00')
  })

  it('edits the terms, rejects a total below what is already repaid, and re-evaluates status', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, baseLoan)
    await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '30000',
      paidAt: '2026-02-01',
    })

    await expect(
      updatePersonalLoanImpl(user.profileId, {
        loanId: id,
        ...baseLoan,
        principal: '20000',
      }),
    ).rejects.toThrow(/already repaid/)

    // Lowering the amount to exactly what was repaid settles the loan.
    await updatePersonalLoanImpl(user.profileId, {
      loanId: id,
      ...baseLoan,
      counterparty: 'Rafiq bhai',
      principal: '30000',
    })
    let loan = await getPersonalLoanImpl(user.profileId, id)
    expect(loan.counterparty).toBe('Rafiq bhai')
    expect(loan.status).toBe('settled')

    // Adding an agreed extra reopens it.
    await updatePersonalLoanImpl(user.profileId, {
      loanId: id,
      ...baseLoan,
      principal: '30000',
      totalRepayable: '32000',
    })
    loan = await getPersonalLoanImpl(user.profileId, id)
    expect(loan.status).toBe('active')
    expect(loan.outstanding).toBe('2000.00')
  })

  it('clears notes when an edit omits them', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, {
      ...baseLoan,
      notes: 'for the bike',
    })
    await updatePersonalLoanImpl(user.profileId, { loanId: id, ...baseLoan })
    expect((await getPersonalLoanImpl(user.profileId, id)).notes).toBeNull()
  })

  it('deletes a loan together with its repayments', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, baseLoan)
    await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '100',
      paidAt: '2026-02-01',
    })

    await deletePersonalLoanImpl(user.profileId, { loanId: id })

    expect(await prisma.personalLoan.count()).toBe(0)
    expect(await prisma.personalLoanRepayment.count()).toBe(0)
  })

  it("never exposes or mutates another profile's loans", async () => {
    const alice = await createTestUser({ email: 'alice@phinio.test' })
    const bob = await createTestUser({ email: 'bob@phinio.test' })
    const { id } = await createPersonalLoanImpl(alice.profileId, baseLoan)
    const repayment = await addLoanRepaymentImpl(alice.profileId, {
      loanId: id,
      amount: '100',
      paidAt: '2026-02-01',
    })

    await expect(getPersonalLoanImpl(bob.profileId, id)).rejects.toThrow(
      'Loan not found',
    )
    await expect(
      addLoanRepaymentImpl(bob.profileId, {
        loanId: id,
        amount: '1',
        paidAt: '2026-02-01',
      }),
    ).rejects.toThrow('Loan not found')
    await expect(
      removeLoanRepaymentImpl(bob.profileId, { repaymentId: repayment.id }),
    ).rejects.toThrow('Repayment not found')
    await expect(
      deletePersonalLoanImpl(bob.profileId, { loanId: id }),
    ).rejects.toThrow('Loan not found')
    expect(
      await listPersonalLoansImpl(bob.profileId, { status: 'active' }),
    ).toEqual([])
  })

  it('replays a repayment with the same clientMutationId instead of logging it twice', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, baseLoan)
    const input = {
      loanId: id,
      amount: '1000',
      paidAt: '2026-02-01',
      clientMutationId: crypto.randomUUID(),
    }

    const first = await addLoanRepaymentImpl(user.profileId, input)
    const second = await addLoanRepaymentImpl(user.profileId, input)

    expect(second).toEqual(first)
    expect(await prisma.personalLoanRepayment.count()).toBe(1)
  })

  it('logs activity for create, repayment and settle', async () => {
    const user = await createTestUser()
    const { id } = await createPersonalLoanImpl(user.profileId, {
      ...baseLoan,
      principal: '100',
    })
    await addLoanRepaymentImpl(user.profileId, {
      loanId: id,
      amount: '100',
      paidAt: '2026-02-01',
    })

    // Rows written in one transaction can share a createdAt, so compare
    // summaries without relying on order.
    const logs = await prisma.activityLog.findMany({
      where: { profileId: user.profileId },
      select: { entityType: true, summary: true },
    })
    expect(logs).toHaveLength(3)
    const summaries = logs.map((l) => `${l.entityType}: ${l.summary}`)
    expect(summaries).toContain("personal_loan: Settled loan with 'Rafiq'")
    expect(
      summaries.some((s) =>
        /^personal_loan: Borrowed .*100\.00 from 'Rafiq'$/.test(s),
      ),
    ).toBe(true)
    expect(
      summaries.some((s) =>
        /^personal_loan_repayment: Repaid .*100\.00 to 'Rafiq'$/.test(s),
      ),
    ).toBe(true)
  })
})
