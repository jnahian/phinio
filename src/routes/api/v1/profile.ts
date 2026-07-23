import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { isLocale } from '#/lib/i18n/config'
import type { Locale } from '#/lib/i18n/config'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  getProfileImpl,
  updateProfileCurrencyImpl,
  updateProfileLanguageImpl,
  updateProfileNameImpl,
} from '#/server/profile.impl'

const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  preferredCurrency: z.enum(['BDT', 'USD']).optional(),
  preferredLanguage: z
    .string()
    .refine(isLocale, { message: 'Unsupported language' })
    .optional(),
  clientMutationId: z.string().min(1).optional(),
})

export function handleGetProfile(request: Request): Promise<Response> {
  return api(async () => {
    const { userId } = await requireApiProfile(request)
    return getProfileImpl(userId)
  })
}

export function handlePatchProfile(request: Request): Promise<Response> {
  return api(async () => {
    const { userId } = await requireApiProfile(request)
    const input = profilePatchSchema.parse(await readMutationInput(request))
    // Each field update is its own withIdempotency call, so one shared key
    // would make the second call replay the first's cached result. Suffix
    // the key per field to keep dedupe correct across retries.
    const key = (suffix: string) =>
      input.clientMutationId ? `${input.clientMutationId}:${suffix}` : undefined
    if (input.fullName !== undefined) {
      await updateProfileNameImpl(userId, {
        fullName: input.fullName,
        clientMutationId: key('name'),
      })
    }
    if (input.preferredCurrency !== undefined) {
      await updateProfileCurrencyImpl(userId, {
        preferredCurrency: input.preferredCurrency,
        clientMutationId: key('currency'),
      })
    }
    if (input.preferredLanguage !== undefined) {
      await updateProfileLanguageImpl(userId, {
        preferredLanguage: input.preferredLanguage,
        clientMutationId: key('language'),
      })
    }
    return getProfileImpl(userId)
  })
}

export const Route = createFileRoute('/api/v1/profile')({
  server: {
    handlers: {
      GET: ({ request }) => handleGetProfile(request),
      PATCH: ({ request }) => handlePatchProfile(request),
    },
  },
})
