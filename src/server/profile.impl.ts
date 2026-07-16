import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import type { Currency } from '#/lib/currency'
import { isLocale } from '#/lib/i18n/config'
import type { Locale } from '#/lib/i18n/config'
import { withIdempotency } from './_idempotency'
import { logActivity } from './activity-log.impl'

export interface SerializedProfile {
  id: string
  userId: string
  fullName: string
  preferredCurrency: Currency
  preferredLanguage: Locale
  createdAt: Date
}

export interface UpdateCurrencyInput {
  preferredCurrency: 'BDT' | 'USD'
  clientMutationId?: string
}

export interface UpdateNameInput {
  fullName: string
  clientMutationId?: string
}

export interface UpdateLanguageInput {
  preferredLanguage: Locale
  clientMutationId?: string
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

function narrowLocale(value: string): Locale {
  return isLocale(value) ? value : 'en'
}

function serializeProfile(row: {
  id: string
  userId: string
  fullName: string
  preferredCurrency: string
  preferredLanguage: string
  createdAt: Date
}): SerializedProfile {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    preferredCurrency: narrowCurrency(row.preferredCurrency),
    preferredLanguage: narrowLocale(row.preferredLanguage),
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
      preferredLanguage: true,
      createdAt: true,
    },
  })
  if (!profile) {
    throw new Error('Profile not found')
  }
  return serializeProfile(profile)
}

// Profile mutations are scoped by userId (the auth identity), but the
// idempotency log is keyed by profileId. Look the profile up first so we
// can hand a real profileId to withIdempotency.
async function profileIdForUser(userId: string): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!profile) throw new Error('Profile not found')
  return profile.id
}

export async function updateProfileCurrencyImpl(
  userId: string,
  data: UpdateCurrencyInput,
): Promise<SerializedProfile> {
  const profileId = await profileIdForUser(userId)
  const profile = await withIdempotency(
    profileId,
    data.clientMutationId,
    async (tx) => {
      // Scope reads/writes by profileId now that we've derived it. Matches
      // the per-query authorization convention used elsewhere in
      // src/server/*.impl.ts.
      const before = await tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true, fullName: true, preferredCurrency: true },
      })
      if (!before) throw new Error('Profile not found')

      const updated = await tx.profile.update({
        where: { id: profileId },
        data: { preferredCurrency: data.preferredCurrency },
        select: {
          id: true,
          userId: true,
          fullName: true,
          preferredCurrency: true,
          preferredLanguage: true,
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
    },
  )
  return serializeProfile(profile)
}

export async function updateProfileLanguageImpl(
  userId: string,
  data: UpdateLanguageInput,
): Promise<SerializedProfile> {
  const profileId = await profileIdForUser(userId)
  const profile = await withIdempotency(
    profileId,
    data.clientMutationId,
    async (tx) => {
      const before = await tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true, fullName: true, preferredLanguage: true },
      })
      if (!before) throw new Error('Profile not found')

      // Mirror onto the User row so the value stays in sync with what
      // Better Auth surfaces in session.user (used by getLocaleFn).
      await tx.user.update({
        where: { id: userId },
        data: { preferredLanguage: data.preferredLanguage },
      })
      const updated = await tx.profile.update({
        where: { id: profileId },
        data: { preferredLanguage: data.preferredLanguage },
        select: {
          id: true,
          userId: true,
          fullName: true,
          preferredCurrency: true,
          preferredLanguage: true,
          createdAt: true,
        },
      })

      if (before.preferredLanguage !== data.preferredLanguage) {
        await logActivity(tx, before.id, {
          action: 'update',
          entityType: 'profile',
          entityId: before.id,
          entityLabel: before.fullName,
          summary: `Changed preferred language to ${data.preferredLanguage}`,
          changes: [
            {
              field: 'Preferred language',
              from: before.preferredLanguage,
              to: data.preferredLanguage,
            },
          ],
        })
      }

      return updated
    },
  )
  return serializeProfile(profile)
}

export async function updateProfileNameImpl(
  userId: string,
  data: UpdateNameInput,
): Promise<SerializedProfile> {
  const profileId = await profileIdForUser(userId)
  const profile = await withIdempotency(
    profileId,
    data.clientMutationId,
    async (tx) => {
      const before = await tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true, fullName: true },
      })
      if (!before) throw new Error('Profile not found')

      // The User row is keyed by userId — that's the auth boundary, not a
      // profile concern — so it stays scoped that way.
      await tx.user.update({
        where: { id: userId },
        data: { name: data.fullName },
      })
      const updated = await tx.profile.update({
        where: { id: profileId },
        data: { fullName: data.fullName },
        select: {
          id: true,
          userId: true,
          fullName: true,
          preferredCurrency: true,
          preferredLanguage: true,
          createdAt: true,
        },
      })

      if (before.fullName !== data.fullName) {
        await logActivity(tx, before.id, {
          action: 'update',
          entityType: 'profile',
          entityId: before.id,
          entityLabel: data.fullName,
          summary: `Changed display name`,
          changes: [
            {
              field: 'Full name',
              from: before.fullName,
              to: data.fullName,
            },
          ],
        })
      }

      return updated
    },
  )
  return serializeProfile(profile)
}
