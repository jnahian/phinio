import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { z } from 'zod'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import {
  calculateEmi,
  generateAmortization,
} from '#/lib/emi-calculator'
import {
  emiCreateSchema,
  emiIdSchema,
  emiListQuerySchema,
  markPaymentPaidSchema,
} from '#/lib/validators'

async function requireProfileId(): Promise<string> {
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
  principal: string
  interestRate: string
  tenureMonths: number
  emiAmount: string
  startDate: Date
  status: string
  createdAt: Date
  payments: Array<SerializedEmiPayment>
}

/**
 * Serialize an EMI (and its payments) from Prisma Decimals to strings so the
 * payload is safe to send across the server-function boundary. Callers must
 * not do arithmetic on these strings; hand them back to formatCurrency or
 * parse to Decimal at the edge.
 */
function serializeEmi(emi: {
  id: string
  profileId: string
  label: string
  type: string
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
  return {
    id: emi.id,
    profileId: emi.profileId,
    label: emi.label,
    type: emi.type,
    principal: String(emi.principal),
    interestRate: String(emi.interestRate),
    tenureMonths: emi.tenureMonths,
    emiAmount: String(emi.emiAmount),
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

export const listEmisFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => emiListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
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
            remainingBalance: true,
          },
          orderBy: { paymentNumber: 'asc' },
        },
      },
    })
    return emis.map((emi) => {
      const totalPayments = emi.payments.length
      const paidCount = emi.payments.filter((p) => p.status === 'paid').length
      const nextUnpaid = emi.payments.find((p) => p.status !== 'paid')
      const remaining = nextUnpaid
        ? String(nextUnpaid.remainingBalance)
        : '0.00'
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
  })

export const getEmiFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => emiIdSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    const emi = await prisma.emi.findFirst({
      where: { id: data.emiId, profileId },
      include: {
        payments: { orderBy: { paymentNumber: 'asc' } },
      },
    })
    if (!emi) throw new Error('EMI not found')
    return serializeEmi(emi)
  })

export const createEmiFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => emiCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()

    // Compute the monthly EMI and generate the schedule outside the
    // transaction so the DB work stays fast.
    const { emiAmount } = calculateEmi({
      principal: data.principal,
      annualRate: data.interestRate,
      tenureMonths: data.tenureMonths,
    })
    const schedule = generateAmortization({
      principal: data.principal,
      annualRate: data.interestRate,
      tenureMonths: data.tenureMonths,
      startDate: new Date(data.startDate),
    })

    // Interactive transaction: create the EMI row, then createMany the
    // payment rows referencing its id. Atomically rolls back on failure.
    const emi = await prisma.$transaction(async (tx) => {
      const created = await tx.emi.create({
        data: {
          profileId,
          label: data.label,
          type: data.type,
          principal: data.principal,
          interestRate: data.interestRate,
          tenureMonths: data.tenureMonths,
          emiAmount,
          startDate: new Date(data.startDate),
        },
      })
      await tx.emiPayment.createMany({
        data: schedule.map((row) => ({
          emiId: created.id,
          profileId,
          paymentNumber: row.paymentNumber,
          dueDate: row.dueDate,
          emiAmount: row.emiAmount,
          principalComponent: row.principalComponent,
          interestComponent: row.interestComponent,
          remainingBalance: row.remainingBalance,
        })),
      })
      return created
    })

    return {
      id: emi.id,
      label: emi.label,
      type: emi.type,
      emiAmount: String(emi.emiAmount),
    }
  })

export const deleteEmiFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => emiIdSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    const result = await prisma.emi.deleteMany({
      where: { id: data.emiId, profileId },
    })
    if (result.count === 0) throw new Error('EMI not found')
    return { id: data.emiId }
  })

export const markPaymentPaidFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => markPaymentPaidSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    // Scope the update to a payment owned by this profile so a leaked ID
    // can't toggle someone else's schedule.
    const result = await prisma.emiPayment.updateMany({
      where: { id: data.paymentId, profileId },
      data: {
        status: data.paid ? 'paid' : 'upcoming',
        paidAt: data.paid ? new Date() : null,
      },
    })
    if (result.count === 0) throw new Error('Payment not found')
    return { id: data.paymentId, paid: data.paid }
  })

export const upcomingPaymentsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const profileId = await requireProfileId()
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const rows = await prisma.emiPayment.findMany({
      where: {
        profileId,
        status: { not: 'paid' },
        dueDate: { lte: in30Days },
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
  },
)

export type EmiListFilters = z.infer<typeof emiListQuerySchema>
