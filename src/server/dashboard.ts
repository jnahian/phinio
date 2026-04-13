import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'

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

/**
 * Aggregate every number the home screen needs in a single round-trip.
 * Keeping it in one handler cuts network latency and prevents "stats from
 * slightly different moments" inconsistency.
 */
export const getDashboardStatsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardStats> => {
    const profileId = await requireProfileId()
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Fire the three queries in parallel.
    const [activeInvestments, activeEmis, upcomingRows] = await Promise.all([
      prisma.investment.findMany({
        where: { profileId, status: 'active' },
        select: { type: true, investedAmount: true, currentValue: true },
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

    // Investment totals
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
    const gainLossPercent =
      invested > 0
        ? Math.round(((current - invested) / invested) * 10000) / 100
        : 0

    // Remaining EMI balance — derived from each EMI's next unpaid row
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

    // Allocation percentages
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

    // Upcoming payments with days-until
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
  },
)
