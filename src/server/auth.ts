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
