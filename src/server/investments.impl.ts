import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { generateDpsSchedule } from '#/lib/dps-calculator'
import { createNotification } from './notifications.impl'
import {
  diffFields,
  fmtDate,
  fmtText,
  getProfileCurrency,
  logActivity,
} from './activity-log.impl'
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
  WithdrawalInput,
  DpsCloseInput,
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
  totalWithdrawn: string
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
      withdrawals: { select: { amount: true } },
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
    const totalWithdrawn = row.withdrawals
      .reduce((sum, w) => sum + Number(w.amount), 0)
      .toFixed(2)

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
      totalWithdrawn,
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

export interface WithdrawalItem {
  id: string
  investmentId: string
  amount: string
  withdrawalDate: Date
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
  withdrawals: WithdrawalItem[]
}

export async function getInvestmentImpl(
  profileId: string,
  id: string,
): Promise<InvestmentDetail> {
  const row = await prisma.investment.findFirst({
    where: { id, profileId },
    include: {
      deposits: { orderBy: { installmentNumber: 'asc' } },
      withdrawals: { orderBy: { withdrawalDate: 'desc' } },
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
    withdrawals: row.withdrawals.map((w) => ({
      id: w.id,
      investmentId: w.investmentId,
      amount: dec(w.amount),
      withdrawalDate: w.withdrawalDate,
      notes: w.notes,
      createdAt: w.createdAt,
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
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.investment.create({
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
    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'investment',
      entityId: created.id,
      entityLabel: created.name,
      summary: `Created investment '${created.name}'`,
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
  const row = await prisma.$transaction(async (tx) => {
    const before = await tx.investment.findFirst({
      where: { id: data.id, profileId },
    })
    if (!before) throw new Error('Investment not found')
    const currency = await getProfileCurrency(tx, profileId)

    const nextExitValue =
      data.status === 'completed' && data.exitValue ? data.exitValue : null
    const nextCompletedAt =
      data.status === 'completed' && data.completedAt
        ? new Date(data.completedAt)
        : null

    const updated = await tx.investment.update({
      where: { id: data.id },
      data: {
        name: data.name,
        type: data.type,
        investedAmount: data.investedAmount,
        currentValue: data.currentValue,
        dateOfInvestment: new Date(data.dateOfInvestment),
        notes: data.notes,
        status: data.status,
        exitValue: nextExitValue,
        completedAt: nextCompletedAt,
      },
    })

    const changes = diffFields(
      before,
      {
        name: data.name,
        type: data.type,
        investedAmount: data.investedAmount,
        currentValue: data.currentValue,
        dateOfInvestment: new Date(data.dateOfInvestment),
        notes: data.notes ?? null,
        status: data.status,
        exitValue: nextExitValue,
        completedAt: nextCompletedAt,
      },
      [
        { key: 'name', label: 'Name', format: fmtText },
        { key: 'type', label: 'Type', format: fmtText },
        { key: 'investedAmount', label: 'Invested amount', isMoney: true },
        { key: 'currentValue', label: 'Current value', isMoney: true },
        { key: 'dateOfInvestment', label: 'Date', format: fmtDate },
        { key: 'notes', label: 'Notes', format: fmtText },
        { key: 'status', label: 'Status', format: fmtText },
        { key: 'exitValue', label: 'Exit value', isMoney: true },
        { key: 'completedAt', label: 'Completed on', format: fmtDate },
      ],
      currency,
    )

    const summary =
      data.status === 'completed' && before.status !== 'completed'
        ? `Marked investment '${updated.name}' as completed`
        : `Edited investment '${updated.name}'`

    await logActivity(tx, profileId, {
      action: 'update',
      entityType: 'investment',
      entityId: updated.id,
      entityLabel: updated.name,
      summary,
      changes,
    })

    return updated
  })
  return { id: row.id }
}

export async function deleteInvestmentImpl(profileId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.investment.findFirst({
      where: { id, profileId },
      select: { id: true, name: true, mode: true },
    })
    if (!existing) throw new Error('Investment not found')
    await tx.investment.delete({ where: { id } })
    const label =
      existing.mode === 'flexible'
        ? `savings pot '${existing.name}'`
        : existing.mode === 'scheduled'
          ? `DPS '${existing.name}'`
          : `investment '${existing.name}'`
    await logActivity(tx, profileId, {
      action: 'delete',
      entityType: 'investment',
      entityId: null,
      entityLabel: existing.name,
      summary: `Deleted ${label}`,
    })
  })
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
    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'investment',
      entityId: inv.id,
      entityLabel: inv.name,
      summary: `Created DPS '${inv.name}' — ${schedule.length} installments scheduled`,
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
  await prisma.$transaction(async (tx) => {
    const before = await tx.investment.findFirst({
      where: { id: data.id, profileId, mode: 'scheduled' },
      select: { id: true, name: true, notes: true },
    })
    if (!before) throw new Error('DPS not found')

    const updated = await tx.investment.update({
      where: { id: data.id },
      data: { name: data.name, notes: data.notes },
    })

    const changes = diffFields(
      before,
      { name: data.name, notes: data.notes ?? null },
      [
        { key: 'name', label: 'Name', format: fmtText },
        { key: 'notes', label: 'Notes', format: fmtText },
      ],
    )

    await logActivity(tx, profileId, {
      action: 'update',
      entityType: 'investment',
      entityId: updated.id,
      entityLabel: updated.name,
      summary: `Edited DPS '${updated.name}'`,
      changes,
    })
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
  await prisma.$transaction(async (tx) => {
    const deposit = await tx.investmentDeposit.findFirst({
      where: { id: data.depositId, profileId },
      select: {
        id: true,
        investmentId: true,
        installmentNumber: true,
        amount: true,
        investment: { select: { name: true } },
      },
    })
    if (!deposit) throw new Error('Deposit not found')

    await tx.investmentDeposit.update({
      where: { id: data.depositId },
      data: {
        status: data.paid ? 'paid' : 'upcoming',
        paidAt: data.paid ? new Date() : null,
      },
    })

    // Sync investedAmount + currentValue = sum of paid deposits
    const paidDeposits = await tx.investmentDeposit.findMany({
      where: { investmentId: deposit.investmentId, status: 'paid' },
      select: { amount: true },
    })
    const totalPaid = paidDeposits.reduce((sum, d) => sum + Number(d.amount), 0)
    await tx.investment.update({
      where: { id: deposit.investmentId },
      data: {
        investedAmount: totalPaid.toFixed(2),
        currentValue: totalPaid.toFixed(2),
      },
    })

    let autoMatured = false
    if (data.paid) {
      const unpaidCount = await tx.investmentDeposit.count({
        where: { investmentId: deposit.investmentId, status: { not: 'paid' } },
      })
      if (unpaidCount === 0) {
        await tx.investment.update({
          where: { id: deposit.investmentId },
          data: { status: 'matured' },
        })
        autoMatured = true
      }
    }

    const installmentLabel = deposit.installmentNumber
      ? `#${deposit.installmentNumber}`
      : ''
    const summary = data.paid
      ? `Marked installment ${installmentLabel} of '${deposit.investment.name}' as paid`
      : `Unmarked installment ${installmentLabel} of '${deposit.investment.name}' as paid`

    await logActivity(tx, profileId, {
      action: 'update',
      entityType: 'investment_deposit',
      entityId: deposit.id,
      entityLabel: deposit.investment.name,
      summary,
    })

    if (autoMatured) {
      await logActivity(tx, profileId, {
        action: 'update',
        entityType: 'investment',
        entityId: deposit.investmentId,
        entityLabel: deposit.investment.name,
        summary: `DPS '${deposit.investment.name}' matured — all installments paid`,
      })
    }
  })

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

    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'investment',
      entityId: created.id,
      entityLabel: created.name,
      summary: `Created savings pot '${created.name}'`,
    })

    return created
  })

  return { id: row.id, name: row.name }
}

export async function updateSavingsInvestmentImpl(
  profileId: string,
  data: SavingsUpdateInput,
) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.investment.findFirst({
      where: { id: data.id, profileId, mode: 'flexible' },
      select: { id: true, name: true, currentValue: true, notes: true },
    })
    if (!before) throw new Error('Savings pot not found')
    const currency = await getProfileCurrency(tx, profileId)

    const updated = await tx.investment.update({
      where: { id: data.id },
      data: {
        name: data.name,
        currentValue: data.currentValue,
        notes: data.notes,
      },
    })

    const changes = diffFields(
      before,
      {
        name: data.name,
        currentValue: data.currentValue,
        notes: data.notes ?? null,
      },
      [
        { key: 'name', label: 'Name', format: fmtText },
        { key: 'currentValue', label: 'Current value', isMoney: true },
        { key: 'notes', label: 'Notes', format: fmtText },
      ],
      currency,
    )

    await logActivity(tx, profileId, {
      action: 'update',
      entityType: 'investment',
      entityId: updated.id,
      entityLabel: updated.name,
      summary: `Edited savings pot '${updated.name}'`,
      changes,
    })
  })
  return { id: data.id }
}

export async function addDepositImpl(profileId: string, data: AddDepositInput) {
  const depositAmount = Number(data.amount)

  await prisma.$transaction(async (tx) => {
    const investment = await tx.investment.findFirst({
      where: { id: data.investmentId, profileId, mode: 'flexible' },
      select: {
        id: true,
        name: true,
        investedAmount: true,
        currentValue: true,
      },
    })
    if (!investment) throw new Error('Savings pot not found')
    const currency = await getProfileCurrency(tx, profileId)

    const deposit = await tx.investmentDeposit.create({
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

    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'investment_deposit',
      entityId: deposit.id,
      entityLabel: investment.name,
      summary: `Added deposit of ${formatCurrency(data.amount, currency)} to '${investment.name}'`,
    })
  })

  return { id: data.investmentId }
}

export async function removeDepositImpl(
  profileId: string,
  data: RemoveDepositInput,
) {
  await prisma.$transaction(async (tx) => {
    const deposit = await tx.investmentDeposit.findFirst({
      where: { id: data.depositId, profileId },
      select: {
        id: true,
        investmentId: true,
        amount: true,
        investment: { select: { name: true } },
      },
    })
    if (!deposit) throw new Error('Deposit not found')
    const currency = await getProfileCurrency(tx, profileId)

    const removedAmount = Number(deposit.amount)

    await tx.investmentDeposit.delete({ where: { id: data.depositId } })
    // Re-sync investedAmount from remaining deposits
    const remaining = await tx.investmentDeposit.findMany({
      where: { investmentId: deposit.investmentId },
      select: { amount: true },
    })
    const newInvested = remaining.reduce((sum, d) => sum + Number(d.amount), 0)

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

    await logActivity(tx, profileId, {
      action: 'delete',
      entityType: 'investment_deposit',
      entityId: null,
      entityLabel: deposit.investment.name,
      summary: `Removed deposit of ${formatCurrency(deposit.amount, currency)} from '${deposit.investment.name}'`,
    })
  })

  return { id: data.depositId }
}

// ---------------------------------------------------------------------------
// Withdrawals — lump_sum + flexible (savings) modes
// ---------------------------------------------------------------------------

function detailRoute(mode: string, id: string): string {
  if (mode === 'flexible') return `/app/investments/savings/${id}`
  if (mode === 'scheduled') return `/app/investments/dps/${id}`
  return `/app/investments/${id}/edit`
}

export async function withdrawImpl(profileId: string, data: WithdrawalInput) {
  const investment = await prisma.investment.findFirst({
    where: { id: data.investmentId, profileId },
    select: {
      id: true,
      name: true,
      mode: true,
      status: true,
      currentValue: true,
    },
  })
  if (!investment) throw new Error('Investment not found')
  if (investment.mode === 'scheduled') {
    throw new Error('Use premature closure for DPS schemes')
  }
  if (investment.status !== 'active') {
    throw new Error('Investment is not active')
  }

  const amount = Number(data.amount)
  const currentValue = Number(investment.currentValue)
  if (amount > currentValue + 0.001) {
    throw new Error('Withdrawal amount exceeds current value')
  }

  const newCurrentValue = Math.max(0, currentValue - amount)
  const shouldClose = data.closeInvestment === true || newCurrentValue === 0

  const currency = await getProfileCurrency(prisma, profileId)

  await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.investmentWithdrawal.create({
      data: {
        investmentId: data.investmentId,
        profileId,
        amount: data.amount,
        withdrawalDate: new Date(data.withdrawalDate),
        notes: data.notes,
      },
    })

    if (shouldClose) {
      const totals = await tx.investmentWithdrawal.aggregate({
        where: { investmentId: data.investmentId },
        _sum: { amount: true },
      })
      const totalExit = Number(totals._sum.amount ?? 0)
      await tx.investment.update({
        where: { id: data.investmentId },
        data: {
          currentValue: newCurrentValue.toFixed(2),
          status: 'completed',
          exitValue: totalExit.toFixed(2),
          completedAt: new Date(data.withdrawalDate),
        },
      })
    } else {
      await tx.investment.update({
        where: { id: data.investmentId },
        data: { currentValue: newCurrentValue.toFixed(2) },
      })
    }

    const amountFmt = formatCurrency(data.amount, currency)
    const summary = shouldClose
      ? `Closed '${investment.name}' with final withdrawal of ${amountFmt}`
      : `Withdrew ${amountFmt} from '${investment.name}'`
    await logActivity(tx, profileId, {
      action: 'create',
      entityType: 'investment_withdrawal',
      entityId: withdrawal.id,
      entityLabel: investment.name,
      summary,
    })
  })

  await createNotification({
    profileId,
    type: 'investment.withdrawal',
    title: shouldClose ? 'Investment closed' : 'Withdrawal recorded',
    body: `${investment.name} — ${formatCurrency(data.amount, currency)} withdrawn`,
    link: detailRoute(investment.mode, investment.id),
    dedupeKey: `investment-withdrawal:${investment.id}:${data.withdrawalDate}:${data.amount}`,
  })

  return { id: investment.id, closed: shouldClose }
}

// ---------------------------------------------------------------------------
// DPS premature closure
// ---------------------------------------------------------------------------

export async function closeDpsImpl(profileId: string, data: DpsCloseInput) {
  const investment = await prisma.investment.findFirst({
    where: { id: data.investmentId, profileId, mode: 'scheduled' },
    select: { id: true, name: true, status: true },
  })
  if (!investment) throw new Error('DPS not found')
  if (investment.status !== 'active') {
    throw new Error('DPS is not active')
  }

  const closureNote = data.notes
    ? `Premature closure. ${data.notes}`
    : 'Premature closure'

  const currency = await getProfileCurrency(prisma, profileId)

  await prisma.$transaction(async (tx) => {
    await tx.investmentWithdrawal.create({
      data: {
        investmentId: data.investmentId,
        profileId,
        amount: data.receivedAmount,
        withdrawalDate: new Date(data.closureDate),
        notes: closureNote,
      },
    })
    await tx.investmentDeposit.deleteMany({
      where: { investmentId: data.investmentId, status: 'upcoming' },
    })
    await tx.investment.update({
      where: { id: data.investmentId },
      data: {
        currentValue: '0.00',
        exitValue: data.receivedAmount,
        status: 'closed',
        completedAt: new Date(data.closureDate),
      },
    })
    await logActivity(tx, profileId, {
      action: 'update',
      entityType: 'investment',
      entityId: investment.id,
      entityLabel: investment.name,
      summary: `Closed DPS '${investment.name}' — received ${formatCurrency(data.receivedAmount, currency)}`,
    })
  })

  await createNotification({
    profileId,
    type: 'investment.dps_closed',
    title: 'DPS closed',
    body: `${investment.name} — received ${formatCurrency(data.receivedAmount, currency)}`,
    link: detailRoute('scheduled', investment.id),
    dedupeKey: `dps-closed:${investment.id}:${data.closureDate}`,
  })

  return { id: investment.id }
}
