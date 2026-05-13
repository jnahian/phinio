import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import type { AppContext } from '@phinio/trpc'

/**
 * Build a tRPC context from an incoming Request.
 *
 * - profileId resolves from the Better Auth session cookie (web) or
 *   `Authorization: Bearer <token>` header (Phase 3 mobile, same Better
 *   Auth, different transport).
 * - prisma is the shared web prisma client (memoized on globalThis for
 *   HMR survival — see apps/web/src/db.ts).
 * - locale: hard-coded to 'en' for Phase 2A. A later plan integrates
 *   the detectLocale helper from #/lib/i18n/detect.server.
 */
export async function createTRPCContext(req: Request): Promise<AppContext> {
  const session = await auth.api.getSession({ headers: req.headers })
  let profileId: string | null = null
  let userId: string | null = null
  if (session) {
    userId = session.user.id
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    profileId = profile?.id ?? null
  }
  return { prisma, profileId, userId, locale: 'en' }
}
