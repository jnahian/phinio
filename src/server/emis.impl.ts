import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { calculateEmi, generateAmortization } from '#/lib/emi-calculator'
import { createNotification } from './notifications.impl'
import { logActivity } from './activity-log.impl'
import type {
  EmiCreateInput,
  EmiListQuery,
  MarkPaymentPaidInput,
} from '#/lib/validators'

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
  principal: string
  interestRate: string
  tenureMonths: number
  emiAmount: string
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
    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'emi',
      entityId: created.id,
      entityLabel: created.label,
      summary: `Created EMI '${created.label}' — ${schedule.length} payments scheduled`,
    })
    return created
  })

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { preferredCurrency: true },
  })
  const currency = (profile?.preferredCurrency ?? 'BDT') as Currency
  await createNotification({
    profileId,
    type: 'emi.created',
    title: 'Loan added',
    body: `${emi.label} — ${formatCurrency(emi.principal, currency)} over ${emi.tenureMonths} months at ${String(emi.interestRate)}%`,
    link: `/app/emis/${emi.id}`,
    dedupeKey: `emi-created:${emi.id}`,
  })

  return {
    id: emi.id,
    label: emi.label,
    type: emi.type,
    emiAmount: String(emi.emiAmount),
  }
}

export async function deleteEmiImpl(profileId: string, emiId: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.emi.findFirst({
      where: { id: emiId, profileId },
      select: { id: true, label: true },
    })
    if (!existing) throw new Error('EMI not found')
    await tx.emi.deleteMany({ where: { id: emiId, profileId } })
    await logActivity(tx, profileId, {
      action: 'delete',
      entityType: 'emi',
      entityId: null,
      entityLabel: existing.label,
      summary: `Deleted EMI '${existing.label}'`,
    })
  })
  return { id: emiId }
}

export async function markPaymentPaidImpl(
  profileId: string,
  data: MarkPaymentPaidInput,
) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.emiPayment.findFirst({
      where: { id: data.paymentId, profileId },
      select: {
        id: true,
        paymentNumber: true,
        emi: { select: { label: true } },
      },
    })
    if (!payment) throw new Error('Payment not found')
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
  })
  return { id: data.paymentId, paid: data.paid }
}

export async function upcomingPaymentsImpl(profileId: string) {
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
}
