import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import type {
  InvestmentCreateInput,
  InvestmentListQuery,
  InvestmentUpdateInput,
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

function serializeInvestment<
  T extends {
    investedAmount: unknown
    currentValue: unknown
    exitValue: unknown
  },
>(investment: T) {
  return {
    ...investment,
    investedAmount: String(investment.investedAmount),
    currentValue: String(investment.currentValue),
    exitValue:
      investment.exitValue === null || investment.exitValue === undefined
        ? null
        : String(investment.exitValue),
  }
}

export async function listInvestmentsImpl(
  profileId: string,
  data: InvestmentListQuery,
) {
  const rows = await prisma.investment.findMany({
    where: {
      profileId,
      status: data.status,
      ...(data.type !== 'all' ? { type: data.type } : {}),
    },
    orderBy: { dateOfInvestment: 'desc' },
  })
  return rows.map(serializeInvestment)
}

export async function getInvestmentImpl(profileId: string, id: string) {
  const row = await prisma.investment.findFirst({
    where: { id, profileId },
  })
  if (!row) throw new Error('Investment not found')
  return serializeInvestment(row)
}

export async function createInvestmentImpl(
  profileId: string,
  data: InvestmentCreateInput,
) {
  const row = await prisma.investment.create({
    data: {
      profileId,
      name: data.name,
      type: data.type,
      investedAmount: data.investedAmount,
      currentValue: data.currentValue,
      dateOfInvestment: new Date(data.dateOfInvestment),
      notes: data.notes,
    },
  })
  return serializeInvestment(row)
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
        data.status === 'completed' && data.exitValue !== undefined
          ? data.exitValue
          : null,
      completedAt:
        data.status === 'completed' && data.completedAt
          ? new Date(data.completedAt)
          : null,
    },
  })
  return serializeInvestment(row)
}

export async function deleteInvestmentImpl(profileId: string, id: string) {
  const result = await prisma.investment.deleteMany({
    where: { id, profileId },
  })
  if (result.count === 0) throw new Error('Investment not found')
  return { id }
}
