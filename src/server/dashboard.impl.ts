import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { FEE_PAYMENT_NUMBER } from '#/lib/emi-calculator'

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

interface UpcomingPaymentBase {
  id: string
  label: string
  type: string
  amount: string
  dueDate: Date
  isOverdue: boolean
  daysUntilDue: number
  // Sequence number within the parent schedule (paymentNumber for EMIs,
  // installmentNumber for deposits). Null when the source row has none.
  sequenceNumber: number | null
}

export type UpcomingPaymentItem =
  | (UpcomingPaymentBase & {
      kind: 'emi'
      emiId: string
      investmentId: null
    })
  | (UpcomingPaymentBase & {
      kind: 'deposit'
      emiId: null
      investmentId: string
    })

export interface DashboardStats {
  netWorth: string
  investmentTotals: {
    invested: string
    current: string
    gainLossPercent: number
  }
  monthlyEmiOutflow: string
  upcomingPayments: Array<UpcomingPaymentItem>
  allocation: Array<{
    type: string
    value: string
    percent: number
  }>
}

export async function getDashboardStatsImpl(
  profileId: string,
): Promise<DashboardStats> {
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [activeInvestments, activeEmis, upcomingEmiRows, upcomingDepositRows] =
    await Promise.all([
      // All active investments — investedAmount + currentValue already synced for
      // scheduled/flexible modes, so no deposit join needed here. Withdrawals
      // restore realized gains to the ROI numerator without inflating the
      // currentValue / allocation totals (withdrawn money is no longer held).
      prisma.investment.findMany({
        where: { profileId, status: 'active' },
        select: {
          type: true,
          investedAmount: true,
          currentValue: true,
          withdrawals: { select: { amount: true } },
        },
      }),
      prisma.emi.findMany({
        where: { profileId, status: 'active' },
        select: {
          id: true,
          emiAmount: true,
          payments: {
            where: { status: { not: 'paid' } },
            select: { emiAmount: true, remainingBalance: true, status: true },
            orderBy: { paymentNumber: 'asc' },
          },
        },
      }),
      prisma.emiPayment.findMany({
        where: {
          profileId,
          status: { not: 'paid' },
          dueDate: { lte: in30Days },
          // Defensively exclude the sentinel processing-fee row (mirrors
          // `upcomingPaymentsImpl`).
          paymentNumber: { gt: FEE_PAYMENT_NUMBER },
        },
        include: {
          emi: { select: { id: true, label: true, type: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.investmentDeposit.findMany({
        where: {
          profileId,
          status: { not: 'paid' },
          dueDate: { not: null, lte: in30Days },
          investment: { mode: 'scheduled', status: 'active' },
        },
        include: {
          investment: { select: { id: true, name: true, type: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ])

  let invested = 0
  let current = 0
  let withdrawn = 0
  const byType = new Map<string, number>()
  for (const row of activeInvestments) {
    const inv = Number(row.investedAmount)
    const cur = Number(row.currentValue)
    const wd = row.withdrawals.reduce((s, w) => s + Number(w.amount), 0)
    invested += inv
    current += cur
    withdrawn += wd
    byType.set(row.type, (byType.get(row.type) ?? 0) + cur)
  }

  const gainLossPercent =
    invested > 0
      ? Math.round(((current + withdrawn - invested) / invested) * 10000) / 100
      : 0

  let remainingEmiBalance = 0
  let monthlyEmiOutflow = 0
  for (const emi of activeEmis) {
    monthlyEmiOutflow += Number(emi.emiAmount)
    // Use the next-unpaid payment's stored `remainingBalance` (the principal
    // payoff after that payment lands), NOT a sum of remaining emiAmounts —
    // emiAmounts include interest and would over-state the liability.
    // Payments are loaded ordered by paymentNumber asc, so the first non-paid
    // entry is the next unpaid one.
    const nextUnpaid = emi.payments.find((p) => p.status !== 'paid')
    if (nextUnpaid) {
      remainingEmiBalance += Number(nextUnpaid.remainingBalance)
    }
  }

  const netWorth = current - remainingEmiBalance

  const totalAllocation = current
  const allocation = Array.from(byType.entries())
    .map(([type, value]) => ({
      type,
      value: value.toFixed(2),
      percent:
        totalAllocation > 0
          ? Math.round((value / totalAllocation) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => Number(b.value) - Number(a.value))

  // dueDate is `@db.Date` (UTC midnight); compare day-to-day so a same-day
  // due item isn't flagged overdue once the wall clock passes UTC midnight,
  // and so daysUntilDue is a clean integer instead of a rounded fraction.
  const DAY_MS = 24 * 60 * 60 * 1000
  const utcDayStart = (d: Date): number =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const nowDay = utcDayStart(now)
  const daysUntil = (target: Date): number =>
    Math.floor((utcDayStart(target) - nowDay) / DAY_MS)
  const isOverdue = (target: Date): boolean => utcDayStart(target) < nowDay

  const upcomingEmiItems: UpcomingPaymentItem[] = upcomingEmiRows.map((p) => ({
    id: p.id,
    kind: 'emi',
    emiId: p.emiId,
    investmentId: null,
    label: p.emi.label,
    type: p.emi.type,
    amount: String(p.emiAmount),
    dueDate: p.dueDate,
    isOverdue: isOverdue(p.dueDate),
    daysUntilDue: daysUntil(p.dueDate),
    sequenceNumber: p.paymentNumber,
  }))

  const upcomingDepositItems: UpcomingPaymentItem[] = upcomingDepositRows
    .filter((d): d is typeof d & { dueDate: Date } => d.dueDate !== null)
    .map((d) => ({
      id: d.id,
      kind: 'deposit',
      emiId: null,
      investmentId: d.investment.id,
      label: d.investment.name,
      type: d.investment.type,
      amount: String(d.amount),
      dueDate: d.dueDate,
      isOverdue: isOverdue(d.dueDate),
      daysUntilDue: daysUntil(d.dueDate),
      sequenceNumber: d.installmentNumber,
    }))

  const upcomingPayments = [...upcomingEmiItems, ...upcomingDepositItems]
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 5)

  return {
    netWorth: netWorth.toFixed(2),
    investmentTotals: {
      invested: invested.toFixed(2),
      current: current.toFixed(2),
      gainLossPercent,
    },
    monthlyEmiOutflow: monthlyEmiOutflow.toFixed(2),
    upcomingPayments,
    allocation,
  }
}
