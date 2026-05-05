import { getRequestHeaders } from '@tanstack/react-start/server'
import type { z } from 'zod'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import {
  FEE_PAYMENT_NUMBER,
  calculateEmi,
  generateAmortization,
  isFeePayment,
  isRegularPayment,
} from '#/lib/emi-calculator'
import { withIdempotency } from './_idempotency'
import { diffFields, fmtText, logActivity } from './activity-log.impl'
import type {
  EmiCreateInput,
  EmiListQuery,
  EmiUpdateInput,
  MarkPaymentPaidInput,
  emiIdSchema,
} from '#/lib/validators'

type EmiIdInput = z.infer<typeof emiIdSchema>

export async function requireProfileId(): Promise<string> {
  const headers = new Headers(getRequestHeaders())
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error('Unauthorized')
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!profile) throw new Error('Profile not found')
  return profile.id
}

export interface SerializedEmiPayment {
  id: string
  emiId: string
  profileId: string
  paymentNumber: number
  dueDate: Date
  emiAmount: string
  principalComponent: string
  interestComponent: string
  remainingBalance: string
  status: string
  paidAt: Date | null
}

export interface SerializedEmi {
  id: string
  profileId: string
  label: string
  type: string
  notes: string | null
  principal: string
  interestRate: string
  tenureMonths: number
  emiAmount: string
  /** One-time processing fee paid at disbursement (null if none). */
  processingFee: string | null
  startDate: Date
  status: string
  createdAt: Date
  payments: Array<SerializedEmiPayment>
}

function serializeEmi(emi: {
  id: string
  profileId: string
  label: string
  type: string
  notes: string | null
  principal: unknown
  interestRate: unknown
  tenureMonths: number
  emiAmount: unknown
  startDate: Date
  status: string
  createdAt: Date
  payments: Array<{
    id: string
    emiId: string
    profileId: string
    paymentNumber: number
    dueDate: Date
    emiAmount: unknown
    principalComponent: unknown
    interestComponent: unknown
    remainingBalance: unknown
    status: string
    paidAt: Date | null
  }>
}): SerializedEmi {
  // The processing fee, when present, is stored as the sentinel fee row
  // (see `FEE_PAYMENT_NUMBER`) so it doesn't require its own column on Emi.
  const feeRow = emi.payments.find(isFeePayment)
  return {
    id: emi.id,
    profileId: emi.profileId,
    label: emi.label,
    type: emi.type,
    notes: emi.notes,
    principal: String(emi.principal),
    interestRate: String(emi.interestRate),
    tenureMonths: emi.tenureMonths,
    emiAmount: String(emi.emiAmount),
    processingFee: feeRow ? String(feeRow.emiAmount) : null,
    startDate: emi.startDate,
    status: emi.status,
    createdAt: emi.createdAt,
    payments: emi.payments.map((p) => ({
      id: p.id,
      emiId: p.emiId,
      profileId: p.profileId,
      paymentNumber: p.paymentNumber,
      dueDate: p.dueDate,
      emiAmount: String(p.emiAmount),
      principalComponent: String(p.principalComponent),
      interestComponent: String(p.interestComponent),
      remainingBalance: String(p.remainingBalance),
      status: p.status,
      paidAt: p.paidAt,
    })),
  }
}

export async function listEmisImpl(profileId: string, data: EmiListQuery) {
  const emis = await prisma.emi.findMany({
    where: {
      profileId,
      status: 'active',
      ...(data.type !== 'all' ? { type: data.type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      payments: {
        select: {
          id: true,
          paymentNumber: true,
          dueDate: true,
          status: true,
          emiAmount: true,
          remainingBalance: true,
        },
        orderBy: { paymentNumber: 'asc' },
      },
    },
  })
  return emis.map((emi) => {
    // Exclude the sentinel fee row from progress and balance derivation —
    // it isn't part of the regular monthly schedule.
    const regularPayments = emi.payments.filter(isRegularPayment)
    const totalPayments = regularPayments.length
    const paidCount = regularPayments.filter((p) => p.status === 'paid').length
    const nextUnpaid = regularPayments.find((p) => p.status !== 'paid')
    // Use the next-unpaid payment's stored `remainingBalance` (principal
    // payoff after that payment) rather than summing remaining emiAmounts —
    // emiAmount includes interest, so summing over-states the liability.
    const remaining = nextUnpaid ? String(nextUnpaid.remainingBalance) : '0.00'
    return {
      id: emi.id,
      label: emi.label,
      type: emi.type,
      principal: String(emi.principal),
      interestRate: String(emi.interestRate),
      tenureMonths: emi.tenureMonths,
      emiAmount: String(emi.emiAmount),
      startDate: emi.startDate,
      status: emi.status,
      createdAt: emi.createdAt,
      totalPayments,
      paidCount,
      nextDueDate: nextUnpaid?.dueDate ?? null,
      remainingBalance: remaining,
    }
  })
}

export async function getEmiImpl(profileId: string, emiId: string) {
  const emi = await prisma.emi.findFirst({
    where: { id: emiId, profileId },
    include: {
      payments: { orderBy: { paymentNumber: 'asc' } },
    },
  })
  if (!emi) throw new Error('EMI not found')
  return serializeEmi(emi)
}

export async function createEmiImpl(profileId: string, data: EmiCreateInput) {
  const { emiAmount } = calculateEmi({
    principal: data.principal,
    annualRate: data.interestRate,
    tenureMonths: data.tenureMonths,
    type: data.type,
  })
  const schedule = generateAmortization({
    principal: data.principal,
    annualRate: data.interestRate,
    tenureMonths: data.tenureMonths,
    startDate: new Date(data.startDate),
    type: data.type,
  })

  // If the client supplied per-payment IDs (offline create flow), they must
  // match the schedule length 1:1 so cache and server agree on identity.
  if (
    data.paymentIds !== undefined &&
    data.paymentIds.length !== schedule.length
  ) {
    throw new Error(
      `paymentIds length (${data.paymentIds.length}) must match schedule length (${schedule.length})`,
    )
  }

  // Treat empty / zero / missing the same — only insert a fee row if the
  // value is a positive amount.
  const feeAmount =
    data.processingFee && Number(data.processingFee) > 0
      ? data.processingFee
      : null

  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const created = await tx.emi.create({
      data: {
        // Use the client-supplied id if present. Prisma's @default(uuid())
        // fills in for legacy callers that don't include one.
        ...(data.id ? { id: data.id } : {}),
        profileId,
        label: data.label,
        type: data.type,
        principal: data.principal,
        interestRate: data.interestRate,
        tenureMonths: data.tenureMonths,
        emiAmount,
        startDate: new Date(data.startDate),
        notes: data.notes,
      },
    })
    const startDate = new Date(data.startDate)
    const now = new Date()
    await tx.emiPayment.createMany({
      data: [
        // Sentinel paymentNumber=0 row for the one-time processing fee. Marked
        // paid immediately because the fee is settled at disbursement.
        ...(feeAmount
          ? [
              {
                ...(data.processingFeeId ? { id: data.processingFeeId } : {}),
                emiId: created.id,
                profileId,
                paymentNumber: FEE_PAYMENT_NUMBER,
                dueDate: startDate,
                emiAmount: feeAmount,
                principalComponent: '0',
                interestComponent: '0',
                remainingBalance: data.principal,
                status: 'paid',
                paidAt: now,
              },
            ]
          : []),
        ...schedule.map((row, i) => ({
          ...(data.paymentIds ? { id: data.paymentIds[i] } : {}),
          emiId: created.id,
          profileId,
          paymentNumber: row.paymentNumber,
          dueDate: row.dueDate,
          emiAmount: row.emiAmount,
          principalComponent: row.principalComponent,
          interestComponent: row.interestComponent,
          remainingBalance: row.remainingBalance,
        })),
      ],
    })
    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'emi',
      entityId: created.id,
      entityLabel: created.label,
      summary: `Created EMI '${created.label}' — ${schedule.length} payments scheduled`,
    })

    return {
      id: created.id,
      label: created.label,
      type: created.type,
      emiAmount: String(created.emiAmount),
      processingFee: feeAmount,
    }
  })
}

export async function updateEmiImpl(profileId: string, data: EmiUpdateInput) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const before = await tx.emi.findFirst({
      where: { id: data.emiId, profileId },
      select: { id: true, label: true, notes: true, updatedAt: true },
    })
    if (!before) throw new Error('EMI not found')

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

    const result = await tx.emi.updateMany({
      where: { id: data.emiId, profileId },
      data: { label: data.label, notes: data.notes },
    })
    if (result.count === 0) throw new Error('EMI not found')
    const updated = await tx.emi.findFirstOrThrow({
      where: { id: data.emiId, profileId },
      select: { id: true, updatedAt: true },
    })

    const changes = diffFields(
      before,
      { label: data.label, notes: data.notes ?? null },
      [
        { key: 'label', label: 'Label', format: fmtText },
        { key: 'notes', label: 'Notes', format: fmtText },
      ],
    )

    if (changes.length > 0) {
      await logActivity(tx, profileId, {
        action: 'update',
        entityType: 'emi',
        entityId: data.emiId,
        entityLabel: data.label,
        summary: `Edited EMI '${data.label}'`,
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

export async function deleteEmiImpl(profileId: string, data: EmiIdInput) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const existing = await tx.emi.findFirst({
      where: { id: data.emiId, profileId },
      select: { id: true, label: true },
    })
    if (!existing) throw new Error('EMI not found')
    await tx.emi.deleteMany({ where: { id: data.emiId, profileId } })
    await logActivity(tx, profileId, {
      action: 'delete',
      entityType: 'emi',
      entityId: null,
      entityLabel: existing.label,
      summary: `Deleted EMI '${existing.label}'`,
    })
    return { id: data.emiId }
  })
}

export async function markPaymentPaidImpl(
  profileId: string,
  data: MarkPaymentPaidInput,
) {
  return withIdempotency(profileId, data.clientMutationId, async (tx) => {
    const payment = await tx.emiPayment.findFirst({
      where: { id: data.paymentId, profileId },
      select: {
        id: true,
        paymentNumber: true,
        emi: { select: { label: true } },
      },
    })
    if (!payment) throw new Error('Payment not found')
    // The sentinel fee row is settled at disbursement and shouldn't be
    // toggled by the schedule UI.
    if (isFeePayment(payment)) {
      throw new Error('Processing fee cannot be modified')
    }
    await tx.emiPayment.updateMany({
      where: { id: data.paymentId, profileId },
      data: {
        status: data.paid ? 'paid' : 'upcoming',
        paidAt: data.paid ? new Date() : null,
      },
    })
    const verb = data.paid ? 'paid' : 'unpaid'
    await logActivity(tx, profileId, {
      action: 'update',
      entityType: 'emi_payment',
      entityId: payment.id,
      entityLabel: payment.emi.label,
      summary: `Marked payment #${payment.paymentNumber} of '${payment.emi.label}' as ${verb}`,
    })
    return { id: data.paymentId, paid: data.paid }
  })
}

export async function upcomingPaymentsImpl(profileId: string) {
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const rows = await prisma.emiPayment.findMany({
    where: {
      profileId,
      status: { not: 'paid' },
      dueDate: { lte: in30Days },
      // Defensively exclude the sentinel fee row, even though `status` already
      // filters it out today — the invariant is worth pinning at the query.
      paymentNumber: { gt: FEE_PAYMENT_NUMBER },
    },
    include: { emi: { select: { id: true, label: true, type: true } } },
    orderBy: { dueDate: 'asc' },
    take: 5,
  })
  return rows.map((p) => ({
    id: p.id,
    emiId: p.emiId,
    emiLabel: p.emi.label,
    emiType: p.emi.type,
    paymentNumber: p.paymentNumber,
    dueDate: p.dueDate,
    emiAmount: String(p.emiAmount),
    isOverdue: p.dueDate < now,
  }))
}
