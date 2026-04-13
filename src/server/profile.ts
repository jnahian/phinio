import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'

async function requireSession() {
  const headers = new Headers(getRequestHeaders())
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export const getProfileFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireSession()
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
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
    return profile
  },
)

const updateCurrencySchema = z.object({
  preferredCurrency: z.enum(['BDT', 'USD']),
})

export const updateProfileCurrencyFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => updateCurrencySchema.parse(input))
  .handler(async ({ data }) => {
    const session = await requireSession()
    const profile = await prisma.profile.update({
      where: { userId: session.user.id },
      data: { preferredCurrency: data.preferredCurrency },
      select: {
        id: true,
        userId: true,
        fullName: true,
        preferredCurrency: true,
        createdAt: true,
      },
    })
    return profile
  })
