import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import type { Currency } from '#/lib/currency'

async function requireSession() {
  const headers = new Headers(getRequestHeaders())
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export interface SerializedProfile {
  id: string
  userId: string
  fullName: string
  preferredCurrency: Currency
  createdAt: Date
}

// Prisma stores `preferredCurrency` as a plain string; narrow it to the
// Currency union at the server-function boundary so every consumer gets a
// typed value and no `as Currency` casts are needed in route components.
function narrowCurrency(value: string): Currency {
  return value === 'USD' ? 'USD' : 'BDT'
}

function serializeProfile(row: {
  id: string
  userId: string
  fullName: string
  preferredCurrency: string
  createdAt: Date
}): SerializedProfile {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    preferredCurrency: narrowCurrency(row.preferredCurrency),
    createdAt: row.createdAt,
  }
}

const updateCurrencySchema = z.object({
  preferredCurrency: z.enum(['BDT', 'USD']),
})
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>

// ----------------------------------------------------------------------------
// Impl functions — take an explicit userId. Tests call these directly.
// ----------------------------------------------------------------------------

export async function getProfileImpl(
  userId: string,
): Promise<SerializedProfile> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      fullName: true,
      preferredCurrency: true,
      createdAt: true,
    },
  })
  if (!profile) {
    throw new Error('Profile not found')
  }
  return serializeProfile(profile)
}

export async function updateProfileCurrencyImpl(
  userId: string,
  data: UpdateCurrencyInput,
): Promise<SerializedProfile> {
  const profile = await prisma.profile.update({
    where: { userId },
    data: { preferredCurrency: data.preferredCurrency },
    select: {
      id: true,
      userId: true,
      fullName: true,
      preferredCurrency: true,
      createdAt: true,
    },
  })
  return serializeProfile(profile)
}

// ----------------------------------------------------------------------------
// Server-function wrappers
// ----------------------------------------------------------------------------

export const getProfileFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SerializedProfile> => {
    const session = await requireSession()
    return getProfileImpl(session.user.id)
  },
)

export const updateProfileCurrencyFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => updateCurrencySchema.parse(input))
  .handler(async ({ data }): Promise<SerializedProfile> => {
    const session = await requireSession()
    return updateProfileCurrencyImpl(session.user.id, data)
  })
