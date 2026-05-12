import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'

/**
 * Resolves the authenticated profile id from the current request's
 * Better Auth session cookie. Throws if the session is missing or the
 * user doesn't have a profile yet. Web-only — mobile resolves profileId
 * via the tRPC context factory instead.
 */
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
