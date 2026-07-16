import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { detectLocale } from '#/lib/i18n/detect.server'
import type { Locale } from '#/lib/i18n/config'

// The top-level `auth` import is deliberately omitted here so client chunks
// that import `getSessionFn` don't pull Better Auth (and transitively Prisma)
// into the browser bundle. The handler body is replaced with an RPC stub on
// the client, so the dynamic import only runs server-side.

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { auth } = await import('#/lib/auth')
    const headers = new Headers(getRequestHeaders())
    return auth.api.getSession({ headers })
  },
)

export const getLocaleFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Locale> => {
    const headers = getRequestHeaders()
    const cookieHeader = (headers.cookie as string | undefined) ?? null
    const acceptLanguageHeader =
      (headers['accept-language'] as string | undefined) ?? null

    let userPreferredLanguage: string | null = null
    try {
      const { auth } = await import('#/lib/auth')
      const session = await auth.api.getSession({
        headers: new Headers(headers),
      })
      userPreferredLanguage =
        (session?.user as { preferredLanguage?: string } | undefined)
          ?.preferredLanguage ?? null
    } catch {
      // Session lookup failed (DB down, etc.) — fall back to header detection.
    }

    return detectLocale({
      cookieHeader,
      acceptLanguageHeader,
      userPreferredLanguage,
    })
  },
)

export interface ShellUser {
  name: string
  email: string
  avatarUrl: string
}

export const getShellUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ShellUser | null> => {
    const { auth } = await import('#/lib/auth')
    const { createHash } = await import('node:crypto')
    const headers = new Headers(getRequestHeaders())
    const session = await auth.api.getSession({ headers })
    if (!session) return null
    const email = session.user.email
    const hash = createHash('sha256')
      .update(email.trim().toLowerCase())
      .digest('hex')
    const avatarUrl =
      session.user.image ?? `https://www.gravatar.com/avatar/${hash}?d=mp&s=80`
    return { name: session.user.name, email, avatarUrl }
  },
)
