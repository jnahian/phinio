import { prisma } from '#/db'
import { Prisma } from '#/generated/prisma/client'
import { formatCurrency } from '#/lib/currency'
import type {
  AddLoanRepaymentInput,
  LoanDirection,
  PersonalLoanCreateInput,
  PersonalLoanIdInput,
  PersonalLoanListQuery,
  PersonalLoanUpdateInput,
  RemoveLoanRepaymentInput,
} from '#/lib/validators'
import { withIdempotency } from './_idempotency'
import {
  diffFields,
  fmtDate,
  fmtText,
  getProfileCurrency,
  logActivity,
} from './activity-log.impl'

export { requireProfileId } from './emis.impl'

type Decimal = Prisma.Decimal

export interface SerializedLoanRepayment {
  id: string
  amount: string
  paidAt: Date
  notes: string | null
}

export interface SerializedPersonalLoan {
  id: string
  direction: LoanDirection
  counterparty: string
  principal: string
  /** Agreed total as entered; null when it equals the principal. */
  totalRepayable: string | null
  /** What has to be repaid in full: totalRepayable ?? principal. */
  totalDue: string
  repaid: string
  outstanding: string
  startDate: Date
  status: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PersonalLoanDetail extends SerializedPersonalLoan {
  repayments: Array<SerializedLoanRepayment>
}

interface LoanRow {
  id: string
  direction: string
  counterparty: string
  principal: Decimal
  totalRepayable: Decimal | null
  startDate: Date
  status: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
  repayments: Array<{ amount: Decimal }>
}

function sumRepaid(repayments: Array<{ amount: Decimal }>): Decimal {
  return repayments.reduce(
    (sum, r) => sum.plus(r.amount),
    new Prisma.Decimal(0),
  )
}

/** Remaining balance of a loan: (totalRepayable ?? principal) − repaid. */
export function loanOutstanding(loan: {
  principal: Decimal
  totalRepayable: Decimal | null
  repayments: Array<{ amount: Decimal }>
}): Decimal {
  return (loan.totalRepayable ?? loan.principal).minus(
    sumRepaid(loan.repayments),
  )
}

function serializeLoan(loan: LoanRow): SerializedPersonalLoan {
  const totalDue = loan.totalRepayable ?? loan.principal
  const repaid = sumRepaid(loan.repayments)
  return {
    id: loan.id,
    direction: loan.direction as LoanDirection,
    counterparty: loan.counterparty,
    principal: loan.principal.toFixed(2),
    totalRepayable: loan.totalRepayable?.toFixed(2) ?? null,
    totalDue: totalDue.toFixed(2),
    repaid: repaid.toFixed(2),
    outstanding: totalDue.minus(repaid).toFixed(2),
    startDate: loan.startDate,
    status: loan.status,
    notes: loan.notes,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
  }
}

// An agreed total equal to the principal carries no information, so it is
// stored as null — the same as leaving it blank.
function normalizeTotal(data: {
  principal: string
  totalRepayable?: string
}): string | null {
  if (data.totalRepayable === undefined) return null
  return new Prisma.Decimal(data.totalRepayable).eq(data.principal)
    ? null
    : data.totalRepayable
}

export async function listPersonalLoansImpl(
  profileId: string,
  data: PersonalLoanListQuery,
): Promise<Array<SerializedPersonalLoan>> {
  const loans = await prisma.personalLoan.findMany({
    where: { profileId, status: data.status },
    orderBy: { createdAt: 'desc' },
    include: { repayments: { select: { amount: true } } },
  })
  return loans.map(serializeLoan)
}

export async function getPersonalLoanImpl(
  profileId: string,
  loanId: string,
): Promise<PersonalLoanDetail> {
  const loan = await prisma.personalLoan.findFirst({
    where: { id: loanId, profileId },
    include: {
      repayments: { orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] },
    },
  })
  if (!loan) throw new Error('Loan not found')
  return {
    ...serializeLoan(loan),
    repayments: loan.repayments.map((r) => ({
      id: r.id,
      amount: r.amount.toFixed(2),
      paidAt: r.paidAt,
      notes: r.notes,
    })),
  }
}

export async function createPersonalLoanImpl(
  profileId: string,
  data: PersonalLoanCreateInput,
) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const currency = await getProfileCurrency(tx, profileId)
    const created = await tx.personalLoan.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        profileId,
        direction: data.direction,
        counterparty: data.counterparty,
        principal: data.principal,
        totalRepayable: normalizeTotal(data),
        startDate: new Date(data.startDate),
        notes: data.notes,
      },
    })
    const amount = formatCurrency(data.principal, currency)
    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'personal_loan',
      entityId: created.id,
      entityLabel: created.counterparty,
      summary:
        data.direction === 'borrowed'
          ? `Borrowed ${amount} from '${created.counterparty}'`
          : `Lent ${amount} to '${created.counterparty}'`,
    })
    return { id: created.id }
  })
}

export async function updatePersonalLoanImpl(
  profileId: string,
  data: PersonalLoanUpdateInput,
) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const before = await tx.personalLoan.findFirst({
      where: { id: data.loanId, profileId },
      select: {
        id: true,
        counterparty: true,
        principal: true,
        totalRepayable: true,
        startDate: true,
        notes: true,
        updatedAt: true,
        repayments: { select: { amount: true } },
      },
    })
    if (!before) throw new Error('Loan not found')

    if (data.expectedUpdatedAt) {
      const expected = new Date(data.expectedUpdatedAt).getTime()
      if (before.updatedAt.getTime() !== expected) {
        return {
          id: before.id,
          updatedAt: before.updatedAt,
          stale: true,
        } as const
      }
    }

    const totalRepayable = normalizeTotal(data)
    const totalDue = new Prisma.Decimal(totalRepayable ?? data.principal)
    const repaid = sumRepaid(before.repayments)
    if (totalDue.lt(repaid)) {
      throw new Error(
        `Total can't be less than the ${repaid.toFixed(2)} already repaid`,
      )
    }

    const updated = await tx.personalLoan.update({
      where: { id: before.id, profileId },
      data: {
        counterparty: data.counterparty,
        principal: data.principal,
        totalRepayable,
        startDate: new Date(data.startDate),
        notes: data.notes ?? null,
        status: totalDue.eq(repaid) ? 'settled' : 'active',
      },
      select: { id: true, updatedAt: true },
    })

    const currency = await getProfileCurrency(tx, profileId)
    const changes = diffFields(
      before,
      {
        counterparty: data.counterparty,
        principal: data.principal,
        totalRepayable,
        startDate: data.startDate,
        notes: data.notes ?? null,
      },
      [
        { key: 'counterparty', label: 'Name', format: fmtText },
        { key: 'principal', label: 'Amount', isMoney: true },
        { key: 'totalRepayable', label: 'Total to repay', isMoney: true },
        { key: 'startDate', label: 'Date', format: fmtDate },
        { key: 'notes', label: 'Notes', format: fmtText },
      ],
      currency,
    )
    if (changes.length > 0) {
      await logActivity(tx, profileId, {
        action: 'update',
        entityType: 'personal_loan',
        entityId: before.id,
        entityLabel: data.counterparty,
        summary: `Edited loan with '${data.counterparty}'`,
        changes,
      })
    }

    return {
      id: updated.id,
      updatedAt: updated.updatedAt,
      stale: false,
    } as const
  })
}

export async function deletePersonalLoanImpl(
  profileId: string,
  data: PersonalLoanIdInput,
) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const existing = await tx.personalLoan.findFirst({
      where: { id: data.loanId, profileId },
      select: { id: true, counterparty: true },
    })
    if (!existing) throw new Error('Loan not found')
    await tx.personalLoan.deleteMany({ where: { id: data.loanId, profileId } })
    await logActivity(tx, profileId, {
      action: 'delete',
      entityType: 'personal_loan',
      entityId: null,
      entityLabel: existing.counterparty,
      summary: `Deleted loan with '${existing.counterparty}'`,
    })
    return { id: data.loanId }
  })
}

export async function addLoanRepaymentImpl(
  profileId: string,
  data: AddLoanRepaymentInput,
) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const loan = await tx.personalLoan.findFirst({
      where: { id: data.loanId, profileId },
      select: {
        id: true,
        direction: true,
        counterparty: true,
        principal: true,
        totalRepayable: true,
        repayments: { select: { amount: true } },
      },
    })
    if (!loan) throw new Error('Loan not found')

    const outstanding = loanOutstanding(loan)
    const amount = new Prisma.Decimal(data.amount)
    if (amount.gt(outstanding)) {
      throw new Error(
        `Amount is more than the ${outstanding.toFixed(2)} still owed`,
      )
    }

    const repayment = await tx.personalLoanRepayment.create({
      data: {
        loanId: loan.id,
        profileId,
        amount: data.amount,
        paidAt: new Date(data.paidAt),
        notes: data.notes,
      },
    })

    const currency = await getProfileCurrency(tx, profileId)
    const formatted = formatCurrency(data.amount, currency)
    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'personal_loan_repayment',
      entityId: repayment.id,
      entityLabel: loan.counterparty,
      summary:
        loan.direction === 'borrowed'
          ? `Repaid ${formatted} to '${loan.counterparty}'`
          : `Received ${formatted} from '${loan.counterparty}'`,
    })

    const settled = amount.eq(outstanding)
    if (settled) {
      await tx.personalLoan.updateMany({
        where: { id: loan.id, profileId },
        data: { status: 'settled' },
      })
      await logActivity(tx, profileId, {
        action: 'update',
        entityType: 'personal_loan',
        entityId: loan.id,
        entityLabel: loan.counterparty,
        summary: `Settled loan with '${loan.counterparty}'`,
      })
    }

    return { id: repayment.id, loanId: loan.id, settled }
  })
}

export async function removeLoanRepaymentImpl(
  profileId: string,
  data: RemoveLoanRepaymentInput,
) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const repayment = await tx.personalLoanRepayment.findFirst({
      where: { id: data.repaymentId, profileId },
      select: {
        id: true,
        amount: true,
        loanId: true,
        loan: { select: { counterparty: true, status: true } },
      },
    })
    if (!repayment) throw new Error('Repayment not found')

    await tx.personalLoanRepayment.deleteMany({
      where: { id: repayment.id, profileId },
    })

    const currency = await getProfileCurrency(tx, profileId)
    await logActivity(tx, profileId, {
      action: 'delete',
      entityType: 'personal_loan_repayment',
      entityId: null,
      entityLabel: repayment.loan.counterparty,
      summary: `Removed payment of ${formatCurrency(repayment.amount.toFixed(2), currency)} from '${repayment.loan.counterparty}'`,
    })

    // Every repayment is > 0, so removing one from a settled loan always
    // leaves something owed again.
    const reopened = repayment.loan.status === 'settled'
    if (reopened) {
      await tx.personalLoan.updateMany({
        where: { id: repayment.loanId, profileId },
        data: { status: 'active' },
      })
      await logActivity(tx, profileId, {
        action: 'update',
        entityType: 'personal_loan',
        entityId: repayment.loanId,
        entityLabel: repayment.loan.counterparty,
        summary: `Reopened loan with '${repayment.loan.counterparty}'`,
      })
    }

    return { id: repayment.id, loanId: repayment.loanId, reopened }
  })
}
