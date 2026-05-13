import type { PrismaClient } from '@phinio/db'

/**
 * Context provided to every tRPC procedure. The HTTP adapter in apps/web
 * builds this from the incoming Request (resolves session + profile, picks
 * a prisma client, detects locale) before calling the router.
 */
export type AppContext = {
  prisma: PrismaClient
  /**
   * The authenticated profile id, or `null` for unauthenticated requests.
   * `protectedProcedure` middleware narrows this to a non-null `profileId`.
   */
  profileId: string | null
  /**
   * The authenticated Better Auth user id, or `null` for unauthenticated
   * requests. Needed by the profile domain, where some operations (name /
   * currency / language) update the underlying `User` row directly rather
   * than only the `Profile`. `protectedProcedure` narrows to non-null.
   */
  userId: string | null
  /** Detected locale (en | bn). */
  locale: string
}
