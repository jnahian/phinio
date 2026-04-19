import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import type { Currency } from '#/lib/currency'
import { logActivity } from './activity-log.impl'

export interface SerializedProfile {
  id: string
  userId: string
  fullName: string
  preferredCurrency: Currency
  createdAt: Date
}

export interface UpdateCurrencyInput {
  preferredCurrency: 'BDT' | 'USD'
}

async function requireSession() {
  const headers = new Headers(getRequestHeaders())
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireUserId(): Promise<string> {
  const session = await requireSession()
  return session.user.id
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
  const profile = await prisma.$transaction(async (tx) => {
    const before = await tx.profile.findUnique({
      where: { userId },
      select: { id: true, fullName: true, preferredCurrency: true },
    })
    if (!before) throw new Error('Profile not found')

    const updated = await tx.profile.update({
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

    if (before.preferredCurrency !== data.preferredCurrency) {
      await logActivity(tx, before.id, {
        action: 'update',
        entityType: 'profile',
        entityId: before.id,
        entityLabel: before.fullName,
        summary: `Changed preferred currency to ${data.preferredCurrency}`,
        changes: [
          {
            field: 'Preferred currency',
            from: before.preferredCurrency,
            to: data.preferredCurrency,
          },
        ],
      })
    }

    return updated
  })
  return serializeProfile(profile)
}

export async function updateProfileNameImpl(
  userId: string,
  fullName: string,
): Promise<SerializedProfile> {
  const profile = await prisma.$transaction(async (tx) => {
    const before = await tx.profile.findUnique({
      where: { userId },
      select: { id: true, fullName: true },
    })
    if (!before) throw new Error('Profile not found')

    await tx.user.update({ where: { id: userId }, data: { name: fullName } })
    const updated = await tx.profile.update({
      where: { userId },
      data: { fullName },
      select: {
        id: true,
        userId: true,
        fullName: true,
        preferredCurrency: true,
        createdAt: true,
      },
    })

    if (before.fullName !== fullName) {
      await logActivity(tx, before.id, {
        action: 'update',
        entityType: 'profile',
        entityId: before.id,
        entityLabel: fullName,
        summary: `Changed display name`,
        changes: [{ field: 'Full name', from: before.fullName, to: fullName }],
      })
    }

    return updated
  })
  return serializeProfile(profile)
}
