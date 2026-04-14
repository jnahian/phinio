import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'

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
