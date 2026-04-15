import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { generateDpsSchedule } from '#/lib/dps-calculator'
import { createNotification } from './notifications.impl'
import type {
  DpsCreateInput,
  DpsListQuery,
  DpsUpdateInput,
  MarkDpsInstallmentPaidInput,
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

export interface SerializedDpsInstallment {
  id: string
  dpsId: string
  installmentNumber: number
  dueDate: Date
  depositAmount: string
  accruedValue: string
  status: string
  paidAt: Date | null
}

export interface SerializedDps {
  id: string
  profileId: string
  name: string
  monthlyDeposit: string
  tenureMonths: number
  interestRate: string
  interestType: string
  startDate: Date
  status: string
  notes: string | null
  createdAt: Date
  installments: SerializedDpsInstallment[]
}

export interface SerializedDpsListItem {
  id: string
  name: string
  monthlyDeposit: string
  tenureMonths: number
  interestRate: string
  interestType: string
  startDate: Date
  status: string
  paidCount: number
  totalDeposited: string
  maturityValue: string
  nextDueDate: Date | null
}

function serializeInstallment(i: {
  id: string
  dpsId: string
  installmentNumber: number
  dueDate: Date
  depositAmount: unknown
  accruedValue: unknown
  status: string
  paidAt: Date | null
}): SerializedDpsInstallment {
  return {
    id: i.id,
    dpsId: i.dpsId,
    installmentNumber: i.installmentNumber,
    dueDate: i.dueDate,
    depositAmount: String(i.depositAmount),
    accruedValue: String(i.accruedValue),
    status: i.status,
    paidAt: i.paidAt,
  }
}

export async function listDpsImpl(
  profileId: string,
  data: DpsListQuery,
): Promise<SerializedDpsListItem[]> {
  const statusFilter =
    data.status === 'active' ? ['active'] : ['matured', 'closed']

  const rows = await prisma.dps.findMany({
    where: { profileId, status: { in: statusFilter } },
    orderBy: { createdAt: 'desc' },
    include: {
      installments: {
        select: {
          id: true,
          installmentNumber: true,
          dueDate: true,
          depositAmount: true,
          accruedValue: true,
          status: true,
        },
        orderBy: { installmentNumber: 'asc' },
      },
    },
  })

  return rows.map((dps) => {
    const paid = dps.installments.filter((i) => i.status === 'paid')
    const totalDeposited = paid.reduce(
      (sum, i) => sum + Number(i.depositAmount),
      0,
    )
    const lastInstallment = dps.installments.at(-1)
    const maturityValue = lastInstallment
      ? String(lastInstallment.accruedValue)
      : '0.00'
    const nextUnpaid = dps.installments.find((i) => i.status !== 'paid')
    return {
      id: dps.id,
      name: dps.name,
      monthlyDeposit: String(dps.monthlyDeposit),
      tenureMonths: dps.tenureMonths,
      interestRate: String(dps.interestRate),
      interestType: dps.interestType,
      startDate: dps.startDate,
      status: dps.status,
      paidCount: paid.length,
      totalDeposited: totalDeposited.toFixed(2),
      maturityValue,
      nextDueDate: nextUnpaid?.dueDate ?? null,
    }
  })
}

export async function getDpsImpl(
  profileId: string,
  dpsId: string,
): Promise<SerializedDps> {
  const dps = await prisma.dps.findFirst({
    where: { id: dpsId, profileId },
    include: {
      installments: { orderBy: { installmentNumber: 'asc' } },
    },
  })
  if (!dps) throw new Error('DPS not found')
  return {
    id: dps.id,
    profileId: dps.profileId,
    name: dps.name,
    monthlyDeposit: String(dps.monthlyDeposit),
    tenureMonths: dps.tenureMonths,
    interestRate: String(dps.interestRate),
    interestType: dps.interestType,
    startDate: dps.startDate,
    status: dps.status,
    notes: dps.notes,
    createdAt: dps.createdAt,
    installments: dps.installments.map(serializeInstallment),
  }
}

export async function createDpsImpl(
  profileId: string,
  data: DpsCreateInput,
): Promise<{ id: string; name: string }> {
  const schedule = generateDpsSchedule({
    monthlyDeposit: data.monthlyDeposit,
    tenureMonths: data.tenureMonths,
    annualRate: data.interestRate,
    interestType: data.interestType,
    startDate: new Date(data.startDate),
  })

  const dps = await prisma.$transaction(async (tx) => {
    const created = await tx.dps.create({
      data: {
        profileId,
        name: data.name,
        monthlyDeposit: data.monthlyDeposit,
        tenureMonths: data.tenureMonths,
        interestRate: data.interestRate,
        interestType: data.interestType,
        startDate: new Date(data.startDate),
        notes: data.notes,
      },
    })
    await tx.dpsInstallment.createMany({
      data: schedule.map((row) => ({
        dpsId: created.id,
        profileId,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate,
        depositAmount: row.depositAmount,
        accruedValue: row.accruedValue,
      })),
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
    type: 'dps.created',
    title: 'DPS scheme added',
    body: `${dps.name} — ${formatCurrency(dps.monthlyDeposit, currency)}/month for ${dps.tenureMonths} months`,
    link: `/app/investments/dps/${dps.id}`,
    dedupeKey: `dps-created:${dps.id}`,
  })

  return { id: dps.id, name: dps.name }
}

export async function updateDpsImpl(
  profileId: string,
  data: DpsUpdateInput,
): Promise<{ id: string }> {
  const existing = await prisma.dps.findFirst({
    where: { id: data.id, profileId },
    select: { id: true },
  })
  if (!existing) throw new Error('DPS not found')
  await prisma.dps.update({
    where: { id: data.id },
    data: { name: data.name, notes: data.notes },
  })
  return { id: data.id }
}

export async function deleteDpsImpl(
  profileId: string,
  dpsId: string,
): Promise<{ id: string }> {
  const result = await prisma.dps.deleteMany({
    where: { id: dpsId, profileId },
  })
  if (result.count === 0) throw new Error('DPS not found')
  return { id: dpsId }
}

export async function markDpsInstallmentPaidImpl(
  profileId: string,
  data: MarkDpsInstallmentPaidInput,
): Promise<{ id: string; paid: boolean }> {
  const result = await prisma.dpsInstallment.updateMany({
    where: { id: data.installmentId, profileId },
    data: {
      status: data.paid ? 'paid' : 'upcoming',
      paidAt: data.paid ? new Date() : null,
    },
  })
  if (result.count === 0) throw new Error('Installment not found')

  // Auto-mature the DPS if all installments are now paid
  if (data.paid) {
    const installment = await prisma.dpsInstallment.findUnique({
      where: { id: data.installmentId },
      select: { dpsId: true },
    })
    if (installment) {
      const unpaidCount = await prisma.dpsInstallment.count({
        where: { dpsId: installment.dpsId, status: { not: 'paid' } },
      })
      if (unpaidCount === 0) {
        await prisma.dps.update({
          where: { id: installment.dpsId },
          data: { status: 'matured' },
        })
      }
    }
  }

  return { id: data.installmentId, paid: data.paid }
}
