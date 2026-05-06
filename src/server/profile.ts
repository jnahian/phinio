import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'
import { LOCALE_COOKIE, SUPPORTED_LOCALES } from '#/lib/i18n/config'
import type { SerializedProfile } from './profile.impl'

export type { SerializedProfile }

const updateCurrencySchema = z.object({
  preferredCurrency: z.enum(['BDT', 'USD']),
  clientMutationId: z.string().uuid().optional(),
})
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>

const updateNameSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  clientMutationId: z.string().uuid().optional(),
})
export type UpdateNameInput = z.infer<typeof updateNameSchema>

const updateLanguageSchema = z.object({
  preferredLanguage: z.enum(SUPPORTED_LOCALES),
  clientMutationId: z.string().uuid().optional(),
})
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>

export const getProfileFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SerializedProfile> => {
    const { requireUserId, getProfileImpl } = await import('./profile.impl')
    return getProfileImpl(await requireUserId())
  },
)

export const updateProfileCurrencyFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => updateCurrencySchema.parse(input))
  .handler(async ({ data }): Promise<SerializedProfile> => {
    const { requireUserId, updateProfileCurrencyImpl } =
      await import('./profile.impl')
    return updateProfileCurrencyImpl(await requireUserId(), data)
  })

export const updateProfileNameFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => updateNameSchema.parse(input))
  .handler(async ({ data }): Promise<SerializedProfile> => {
    const { requireUserId, updateProfileNameImpl } =
      await import('./profile.impl')
    return updateProfileNameImpl(await requireUserId(), data)
  })

export const updateProfileLanguageFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => updateLanguageSchema.parse(input))
  .handler(async ({ data }): Promise<SerializedProfile> => {
    const { requireUserId, updateProfileLanguageImpl } =
      await import('./profile.impl')
    const profile = await updateProfileLanguageImpl(await requireUserId(), data)

    // Persist the choice as a cookie too so anonymous SSR (e.g. immediately
    // after sign-out / before the next session loads) still reflects the
    // user's last preference. 1-year expiry, SameSite=Lax, Secure in prod.
    const isProd = process.env.NODE_ENV === 'production'
    const maxAge = 60 * 60 * 24 * 365
    setResponseHeader(
      'Set-Cookie',
      `${LOCALE_COOKIE}=${data.preferredLanguage}; Path=/; Max-Age=${maxAge}; SameSite=Lax${isProd ? '; Secure' : ''}`,
    )

    return profile
  })
