import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'

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

export interface DashboardStats {
  netWorth: string
  investmentTotals: {
    invested: string
    current: string
    gainLossPercent: number
  }
  monthlyEmiOutflow: string
  upcomingPayments: Array<{
    id: string
    emiId: string
    emiLabel: string
    emiType: string
    paymentNumber: number
    dueDate: Date
    emiAmount: string
    isOverdue: boolean
    daysUntilDue: number
  }>
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

  const [activeInvestments, activeDps, activeEmis, upcomingRows] =
    await Promise.all([
      prisma.investment.findMany({
        where: { profileId, status: 'active' },
        select: { type: true, investedAmount: true, currentValue: true },
      }),
      prisma.dps.findMany({
        where: { profileId, status: 'active' },
        select: {
          id: true,
          installments: {
            where: { status: 'paid' },
            select: { depositAmount: true },
          },
        },
      }),
      prisma.emi.findMany({
        where: { profileId, status: 'active' },
        select: {
          id: true,
          emiAmount: true,
          payments: {
            where: { status: { not: 'paid' } },
            select: { remainingBalance: true },
            orderBy: { paymentNumber: 'asc' },
            take: 1,
          },
        },
      }),
      prisma.emiPayment.findMany({
        where: {
          profileId,
          status: { not: 'paid' },
          dueDate: { lte: in30Days },
        },
        include: {
          emi: { select: { id: true, label: true, type: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ])

  let invested = 0
  let current = 0
  const byType = new Map<string, number>()
  for (const row of activeInvestments) {
    const inv = Number(row.investedAmount)
    const cur = Number(row.currentValue)
    invested += inv
    current += cur
    byType.set(row.type, (byType.get(row.type) ?? 0) + cur)
  }
  // DPS: currentValue = total deposited so far (sum of paid installments)
  for (const dps of activeDps) {
    const totalDeposited = dps.installments.reduce(
      (sum, i) => sum + Number(i.depositAmount),
      0,
    )
    invested += totalDeposited
    current += totalDeposited
    byType.set('dps', (byType.get('dps') ?? 0) + totalDeposited)
  }
  const gainLossPercent =
    invested > 0
      ? Math.round(((current - invested) / invested) * 10000) / 100
      : 0

  let remainingEmiBalance = 0
  let monthlyEmiOutflow = 0
  for (const emi of activeEmis) {
    monthlyEmiOutflow += Number(emi.emiAmount)
    const nextUnpaid = emi.payments.at(0)
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

  const upcomingPayments = upcomingRows.map((p) => {
    const days = Math.round(
      (p.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    )
    return {
      id: p.id,
      emiId: p.emiId,
      emiLabel: p.emi.label,
      emiType: p.emi.type,
      paymentNumber: p.paymentNumber,
      dueDate: p.dueDate,
      emiAmount: String(p.emiAmount),
      isOverdue: p.dueDate < now,
      daysUntilDue: days,
    }
  })

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
