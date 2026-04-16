import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { generateDpsSchedule } from '#/lib/dps-calculator'
import { createNotification } from './notifications.impl'
import type {
  InvestmentCreateInput,
  InvestmentListQuery,
  InvestmentUpdateInput,
  DpsCreateInput,
  DpsUpdateInput,
  MarkDepositPaidInput,
  SavingsCreateInput,
  SavingsUpdateInput,
  AddDepositInput,
  RemoveDepositInput,
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

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

function dec(v: unknown): string {
  return String(v)
}

function decOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v)
}

// ---------------------------------------------------------------------------
// List — unified across all three modes
// ---------------------------------------------------------------------------

export interface InvestmentListItem {
  id: string
  name: string
  type: string
  mode: string
  status: string
  notes: string | null
  createdAt: Date
  // lump_sum
  investedAmount: string
  currentValue: string
  exitValue: string | null
  dateOfInvestment: Date | null
  // scheduled (DPS)
  monthlyDeposit: string | null
  tenureMonths: number | null
  interestRate: string | null
  interestType: string | null
  startDate: Date | null
  paidCount: number
  maturityValue: string | null
  nextDueDate: Date | null
}

export async function listInvestmentsImpl(
  profileId: string,
  data: InvestmentListQuery,
): Promise<InvestmentListItem[]> {
  const statusFilter =
    data.status === 'active' ? ['active'] : ['completed', 'matured', 'closed']

  const typeFilter =
    data.type === 'all'
      ? undefined
      : data.type === 'dps'
        ? 'dps'
        : data.type === 'savings'
          ? 'savings'
          : data.type

  const rows = await prisma.investment.findMany({
    where: {
      profileId,
      status: { in: statusFilter },
      ...(typeFilter !== undefined ? { type: typeFilter } : {}),
    },
    include: {
      deposits: {
        select: {
          installmentNumber: true,
          dueDate: true,
          accruedValue: true,
          status: true,
        },
        orderBy: { installmentNumber: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map((row) => {
    const paidDeposits = row.deposits.filter((d) => d.status === 'paid')
    const paidCount = paidDeposits.length
    const lastDeposit = row.deposits.at(-1)
    const maturityValue =
      row.mode === 'scheduled' && lastDeposit?.accruedValue
        ? dec(lastDeposit.accruedValue)
        : null
    const nextUnpaid = row.deposits.find((d) => d.status !== 'paid')
    const nextDueDate =
      row.mode === 'scheduled' ? (nextUnpaid?.dueDate ?? null) : null

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      mode: row.mode,
      status: row.status,
      notes: row.notes,
      createdAt: row.createdAt,
      investedAmount: dec(row.investedAmount),
      currentValue: dec(row.currentValue),
      exitValue: decOrNull(row.exitValue),
      dateOfInvestment: row.dateOfInvestment,
      monthlyDeposit: decOrNull(row.monthlyDeposit),
      tenureMonths: row.tenureMonths,
      interestRate: decOrNull(row.interestRate),
      interestType: row.interestType,
      startDate: row.startDate,
      paidCount,
      maturityValue,
      nextDueDate,
    }
  })
}

// ---------------------------------------------------------------------------
// Detail — includes full deposit list
// ---------------------------------------------------------------------------

export interface DepositItem {
  id: string
  investmentId: string
  amount: string
  dueDate: Date | null
  paidAt: Date | null
  accruedValue: string | null
  installmentNumber: number | null
  status: string
  notes: string | null
  createdAt: Date
}

export interface InvestmentDetail {
  id: string
  profileId: string
  name: string
  type: string
  mode: string
  status: string
  notes: string | null
  createdAt: Date
  investedAmount: string
  currentValue: string
  exitValue: string | null
  dateOfInvestment: Date | null
  completedAt: Date | null
  monthlyDeposit: string | null
  tenureMonths: number | null
  interestRate: string | null
  interestType: string | null
  startDate: Date | null
  deposits: DepositItem[]
}

export async function getInvestmentImpl(
  profileId: string,
  id: string,
): Promise<InvestmentDetail> {
  const row = await prisma.investment.findFirst({
    where: { id, profileId },
    include: {
      deposits: { orderBy: { installmentNumber: 'asc' } },
    },
  })
  if (!row) throw new Error('Investment not found')
  return {
    id: row.id,
    profileId: row.profileId,
    name: row.name,
    type: row.type,
    mode: row.mode,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    investedAmount: dec(row.investedAmount),
    currentValue: dec(row.currentValue),
    exitValue: decOrNull(row.exitValue),
    dateOfInvestment: row.dateOfInvestment,
    completedAt: row.completedAt,
    monthlyDeposit: decOrNull(row.monthlyDeposit),
    tenureMonths: row.tenureMonths,
    interestRate: decOrNull(row.interestRate),
    interestType: row.interestType,
    startDate: row.startDate,
    deposits: row.deposits.map((d) => ({
      id: d.id,
      investmentId: d.investmentId,
      amount: dec(d.amount),
      dueDate: d.dueDate,
      paidAt: d.paidAt,
      accruedValue: decOrNull(d.accruedValue),
      installmentNumber: d.installmentNumber,
      status: d.status,
      notes: d.notes,
      createdAt: d.createdAt,
    })),
  }
}

// ---------------------------------------------------------------------------
// Lump-sum create / update / delete
// ---------------------------------------------------------------------------

export async function createInvestmentImpl(
  profileId: string,
  data: InvestmentCreateInput,
) {
  const row = await prisma.investment.create({
    data: {
      profileId,
      name: data.name,
      type: data.type,
      mode: 'lump_sum',
      investedAmount: data.investedAmount,
      currentValue: data.currentValue,
      dateOfInvestment: new Date(data.dateOfInvestment),
      notes: data.notes,
    },
  })
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { preferredCurrency: true },
  })
  const currency = (profile?.preferredCurrency ?? 'BDT') as Currency
  await createNotification({
    profileId,
    type: 'investment.created',
    title: 'Investment added',
    body: `${row.name} — ${formatCurrency(row.investedAmount, currency)}`,
    link: `/app/investments/${row.id}/edit`,
    dedupeKey: `investment-created:${row.id}`,
  })
  return { id: row.id }
}

export async function updateInvestmentImpl(
  profileId: string,
  data: InvestmentUpdateInput,
) {
  const existing = await prisma.investment.findFirst({
    where: { id: data.id, profileId },
    select: { id: true },
  })
  if (!existing) throw new Error('Investment not found')
  const row = await prisma.investment.update({
    where: { id: data.id },
    data: {
      name: data.name,
      type: data.type,
      investedAmount: data.investedAmount,
      currentValue: data.currentValue,
      dateOfInvestment: new Date(data.dateOfInvestment),
      notes: data.notes,
      status: data.status,
      exitValue:
        data.status === 'completed' && data.exitValue ? data.exitValue : null,
      completedAt:
        data.status === 'completed' && data.completedAt
          ? new Date(data.completedAt)
          : null,
    },
  })
  return { id: row.id }
}

export async function deleteInvestmentImpl(profileId: string, id: string) {
  const result = await prisma.investment.deleteMany({
    where: { id, profileId },
  })
  if (result.count === 0) throw new Error('Investment not found')
  return { id }
}

// ---------------------------------------------------------------------------
// DPS (scheduled) create / update
// ---------------------------------------------------------------------------

export async function createDpsInvestmentImpl(
  profileId: string,
  data: DpsCreateInput,
) {
  const schedule = generateDpsSchedule({
    monthlyDeposit: data.monthlyDeposit,
    tenureMonths: data.tenureMonths,
    annualRate: data.interestRate,
    interestType: data.interestType,
    startDate: new Date(data.startDate),
  })

  const row = await prisma.$transaction(async (tx) => {
    const inv = await tx.investment.create({
      data: {
        profileId,
        name: data.name,
        type: 'dps',
        mode: 'scheduled',
        investedAmount: 0,
        currentValue: 0,
        monthlyDeposit: data.monthlyDeposit,
        tenureMonths: data.tenureMonths,
        interestRate: data.interestRate,
        interestType: data.interestType,
        startDate: new Date(data.startDate),
        notes: data.notes,
      },
    })
    await tx.investmentDeposit.createMany({
      data: schedule.map((s) => ({
        investmentId: inv.id,
        profileId,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        amount: s.depositAmount,
        accruedValue: s.accruedValue,
        status: 'upcoming',
      })),
    })
    return inv
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
    body: `${row.name} — ${formatCurrency(row.monthlyDeposit ?? '0', currency)}/month for ${row.tenureMonths} months`,
    link: `/app/investments/dps/${row.id}`,
    dedupeKey: `dps-created:${row.id}`,
  })

  return { id: row.id, name: row.name }
}

export async function updateDpsInvestmentImpl(
  profileId: string,
  data: DpsUpdateInput,
) {
  const existing = await prisma.investment.findFirst({
    where: { id: data.id, profileId, mode: 'scheduled' },
    select: { id: true },
  })
  if (!existing) throw new Error('DPS not found')
  await prisma.investment.update({
    where: { id: data.id },
    data: { name: data.name, notes: data.notes },
  })
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// DPS installment mark paid — syncs investedAmount + currentValue
// ---------------------------------------------------------------------------

export async function markDepositPaidImpl(
  profileId: string,
  data: MarkDepositPaidInput,
) {
  const result = await prisma.investmentDeposit.updateMany({
    where: { id: data.depositId, profileId },
    data: {
      status: data.paid ? 'paid' : 'upcoming',
      paidAt: data.paid ? new Date() : null,
    },
  })
  if (result.count === 0) throw new Error('Deposit not found')

  // Sync investedAmount + currentValue = sum of paid deposits
  const deposit = await prisma.investmentDeposit.findUnique({
    where: { id: data.depositId },
    select: { investmentId: true },
  })
  if (!deposit) throw new Error('Deposit not found')

  const { investmentId } = deposit
  const paidDeposits = await prisma.investmentDeposit.findMany({
    where: { investmentId, status: 'paid' },
    select: { amount: true },
  })
  const totalPaid = paidDeposits.reduce(
    (sum, d) => sum + Number(d.amount),
    0,
  )

  await prisma.investment.update({
    where: { id: investmentId },
    data: {
      investedAmount: totalPaid.toFixed(2),
      currentValue: totalPaid.toFixed(2),
    },
  })

  // Auto-mature if all installments paid
  if (data.paid) {
    const unpaidCount = await prisma.investmentDeposit.count({
      where: { investmentId, status: { not: 'paid' } },
    })
    if (unpaidCount === 0) {
      await prisma.investment.update({
        where: { id: investmentId },
        data: { status: 'matured' },
      })
    }
  }

  return { id: data.depositId, paid: data.paid }
}

// ---------------------------------------------------------------------------
// Savings (flexible) create / update / add deposit / remove deposit
// ---------------------------------------------------------------------------

export async function createSavingsInvestmentImpl(
  profileId: string,
  data: SavingsCreateInput,
) {
  const initialAmount = Number(data.currentValue)

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.investment.create({
      data: {
        profileId,
        name: data.name,
        type: 'savings',
        mode: 'flexible',
        investedAmount: initialAmount > 0 ? data.currentValue : 0,
        currentValue: data.currentValue,
        startDate: new Date(data.startDate),
        notes: data.notes,
      },
    })

    if (initialAmount > 0) {
      await tx.investmentDeposit.create({
        data: {
          investmentId: created.id,
          profileId,
          amount: data.currentValue,
          dueDate: new Date(data.startDate),
          paidAt: new Date(data.startDate),
          status: 'paid',
          notes: 'Initial deposit',
        },
      })
    }

    return created
  })

  return { id: row.id, name: row.name }
}

export async function updateSavingsInvestmentImpl(
  profileId: string,
  data: SavingsUpdateInput,
) {
  const existing = await prisma.investment.findFirst({
    where: { id: data.id, profileId, mode: 'flexible' },
    select: { id: true },
  })
  if (!existing) throw new Error('Savings pot not found')
  await prisma.investment.update({
    where: { id: data.id },
    data: {
      name: data.name,
      currentValue: data.currentValue,
      notes: data.notes,
    },
  })
  return { id: data.id }
}

export async function addDepositImpl(
  profileId: string,
  data: AddDepositInput,
) {
  const investment = await prisma.investment.findFirst({
    where: { id: data.investmentId, profileId, mode: 'flexible' },
    select: { id: true, investedAmount: true, currentValue: true },
  })
  if (!investment) throw new Error('Savings pot not found')

  const depositAmount = Number(data.amount)

  await prisma.$transaction(async (tx) => {
    await tx.investmentDeposit.create({
      data: {
        investmentId: data.investmentId,
        profileId,
        amount: data.amount,
        dueDate: new Date(data.depositDate),
        paidAt: new Date(data.depositDate),
        status: 'paid',
        notes: data.notes,
      },
    })
    const newInvested = Number(investment.investedAmount) + depositAmount
    const newCurrentValue = Number(investment.currentValue) + depositAmount
    await tx.investment.update({
      where: { id: data.investmentId },
      data: {
        investedAmount: newInvested.toFixed(2),
        currentValue: newCurrentValue.toFixed(2),
      },
    })
  })

  return { id: data.investmentId }
}

export async function removeDepositImpl(
  profileId: string,
  data: RemoveDepositInput,
) {
  const deposit = await prisma.investmentDeposit.findFirst({
    where: { id: data.depositId, profileId },
    select: { id: true, investmentId: true, amount: true },
  })
  if (!deposit) throw new Error('Deposit not found')

  const removedAmount = Number(deposit.amount)

  await prisma.$transaction(async (tx) => {
    await tx.investmentDeposit.delete({ where: { id: data.depositId } })
    // Re-sync investedAmount from remaining deposits
    const remaining = await tx.investmentDeposit.findMany({
      where: { investmentId: deposit.investmentId },
      select: { amount: true },
    })
    const newInvested = remaining.reduce(
      (sum, d) => sum + Number(d.amount),
      0,
    )

    const investment = await tx.investment.findUniqueOrThrow({
      where: { id: deposit.investmentId },
      select: { currentValue: true },
    })
    const newCurrentValue = Math.max(
      0,
      Number(investment.currentValue) - removedAmount,
    )

    await tx.investment.update({
      where: { id: deposit.investmentId },
      data: {
        investedAmount: newInvested.toFixed(2),
        currentValue: newCurrentValue.toFixed(2),
      },
    })
  })

  return { id: data.depositId }
}
