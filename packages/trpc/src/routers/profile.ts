import {
  SUPPORTED_LOCALES,
  updateProfileCurrencySchema,
  updateProfileLanguageSchema,
  updateProfileNameSchema,
  type PreferredCurrency,
  type SupportedLocale,
} from '@phinio/validators'
import type { PrismaClient } from '@phinio/db'
import { withIdempotency } from '../idempotency.js'
import { logActivity } from '../activity-log.js'
import { protectedProcedure, router } from '../trpc.js'

export interface SerializedProfile {
  id: string
  userId: string
  fullName: string
  preferredCurrency: PreferredCurrency
  preferredLanguage: SupportedLocale
  createdAt: Date
}

// Prisma stores these as plain strings; narrow to the union at the
// router boundary so consumers don't need `as Currency` casts.
function narrowCurrency(value: string): PreferredCurrency {
  return value === 'USD' ? 'USD' : 'BDT'
}

function narrowLocale(value: string): SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as SupportedLocale)
    : 'en'
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

const profileSelect = {
  id: true,
  userId: true,
  fullName: true,
  preferredCurrency: true,
  preferredLanguage: true,
  createdAt: true,
} as const

// Helper hand-off: most domain procedures scope by profileId directly, but the
// profile mutations also touch the User row, so we keep both ids in scope.
type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

async function findProfileOrThrow(
  tx: Tx,
  profileId: string,
  select: Parameters<Tx['profile']['findUnique']>[0]['select'],
) {
  const row = await tx.profile.findUnique({ where: { id: profileId }, select })
  if (!row) throw new Error('Profile not found')
  return row
}

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.prisma.profile.findUnique({
      where: { userId: ctx.userId },
      select: profileSelect,
    })
    if (!profile) throw new Error('Profile not found')
    return serializeProfile(profile)
  }),

  updateCurrency: protectedProcedure
    .input(updateProfileCurrencySchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await withIdempotency(
        ctx.prisma,
        ctx.profileId,
        input.clientMutationId,
        async (tx) => {
          const before = await findProfileOrThrow(tx, ctx.profileId, {
            id: true,
            fullName: true,
            preferredCurrency: true,
          })

          const updated = await tx.profile.update({
            where: { id: ctx.profileId },
            data: { preferredCurrency: input.preferredCurrency },
            select: profileSelect,
          })

          if (before.preferredCurrency !== input.preferredCurrency) {
            await logActivity(tx, ctx.profileId, {
              action: 'update',
              entityType: 'profile',
              entityId: before.id,
              entityLabel: before.fullName,
              summary: `Changed preferred currency to ${input.preferredCurrency}`,
              changes: [
                {
                  field: 'Preferred currency',
                  from: before.preferredCurrency,
                  to: input.preferredCurrency,
                },
              ],
            })
          }

          return updated
        },
      )
      return serializeProfile(profile)
    }),

  updateName: protectedProcedure
    .input(updateProfileNameSchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await withIdempotency(
        ctx.prisma,
        ctx.profileId,
        input.clientMutationId,
        async (tx) => {
          const before = await findProfileOrThrow(tx, ctx.profileId, {
            id: true,
            fullName: true,
          })

          // The User row is keyed by userId — that's the auth boundary, not a
          // profile concern — so it stays scoped that way.
          await tx.user.update({
            where: { id: ctx.userId },
            data: { name: input.fullName },
          })
          const updated = await tx.profile.update({
            where: { id: ctx.profileId },
            data: { fullName: input.fullName },
            select: profileSelect,
          })

          if (before.fullName !== input.fullName) {
            await logActivity(tx, ctx.profileId, {
              action: 'update',
              entityType: 'profile',
              entityId: before.id,
              entityLabel: input.fullName,
              summary: `Changed display name`,
              changes: [
                {
                  field: 'Full name',
                  from: before.fullName,
                  to: input.fullName,
                },
              ],
            })
          }

          return updated
        },
      )
      return serializeProfile(profile)
    }),

  updateLanguage: protectedProcedure
    .input(updateProfileLanguageSchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await withIdempotency(
        ctx.prisma,
        ctx.profileId,
        input.clientMutationId,
        async (tx) => {
          const before = await findProfileOrThrow(tx, ctx.profileId, {
            id: true,
            fullName: true,
            preferredLanguage: true,
          })

          // Mirror onto the User row so the value stays in sync with what
          // Better Auth surfaces in session.user (used by getLocaleFn).
          await tx.user.update({
            where: { id: ctx.userId },
            data: { preferredLanguage: input.preferredLanguage },
          })
          const updated = await tx.profile.update({
            where: { id: ctx.profileId },
            data: { preferredLanguage: input.preferredLanguage },
            select: profileSelect,
          })

          if (before.preferredLanguage !== input.preferredLanguage) {
            await logActivity(tx, ctx.profileId, {
              action: 'update',
              entityType: 'profile',
              entityId: before.id,
              entityLabel: before.fullName,
              summary: `Changed preferred language to ${input.preferredLanguage}`,
              changes: [
                {
                  field: 'Preferred language',
                  from: before.preferredLanguage,
                  to: input.preferredLanguage,
                },
              ],
            })
          }

          return updated
        },
      )
      return serializeProfile(profile)
    }),
})
