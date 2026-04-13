import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { z } from 'zod'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import {
  investmentCreateSchema,
  investmentIdSchema,
  investmentListQuerySchema,
  investmentUpdateSchema,
} from '#/lib/validators'
import type {
  InvestmentCreateInput,
  InvestmentListQuery,
  InvestmentUpdateInput,
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

/**
 * Convert Prisma Decimal fields to plain strings so the payload is safe to
 * serialize across the server-function boundary. Never perform arithmetic on
 * these before re-hydrating at the UI.
 */
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

// ----------------------------------------------------------------------------
// Impl functions — take an explicit profileId. The exported *Fn wrappers
// below derive profileId from the session and delegate. Tests import these
// directly so they can bypass the TanStack Start build pipeline.
// ----------------------------------------------------------------------------

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
  // Scope the update to rows this profile owns
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
  // deleteMany with profileId scope returns count=0 if not owned
  const result = await prisma.investment.deleteMany({
    where: { id, profileId },
  })
  if (result.count === 0) throw new Error('Investment not found')
  return { id }
}

// ----------------------------------------------------------------------------
// Server-function wrappers
// ----------------------------------------------------------------------------

export const listInvestmentsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => investmentListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    return listInvestmentsImpl(profileId, data)
  })

export const getInvestmentFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => investmentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    return getInvestmentImpl(profileId, data.id)
  })

export const createInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    return createInvestmentImpl(profileId, data)
  })

export const updateInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    return updateInvestmentImpl(profileId, data)
  })

export const deleteInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const profileId = await requireProfileId()
    return deleteInvestmentImpl(profileId, data.id)
  })

// Helper so call sites can derive the list-query key consistently.
export type InvestmentListFilters = z.infer<typeof investmentListQuerySchema>
