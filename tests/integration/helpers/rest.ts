import { auth } from '#/lib/auth'
import { prisma } from './db'

export interface AuthedUser {
  token: string
  userId: string
  profileId: string
  email: string
}

/**
 * Sign up + verify + sign in through Better Auth's server API, returning a
 * bearer token usable as `Authorization: Bearer <token>`. Uses the real auth
 * stack so bearer-plugin token signing is exercised, not mocked.
 */
export async function createAuthedUser(
  overrides: { email?: string } = {},
): Promise<AuthedUser> {
  const email = overrides.email ?? `rest_${crypto.randomUUID()}@phinio.test`
  const password = 'password123'
  await auth.api.signUpEmail({
    body: {
      name: 'Rest Tester',
      email,
      password,
      preferredCurrency: 'BDT',
    },
  })
  // requireEmailVerification blocks sign-in until verified; flip it directly.
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  })
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  })
  const token = headers.get('set-auth-token')
  if (!token) throw new Error('sign-in did not return set-auth-token header')
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { userId: user.id },
    select: { id: true },
  })
  return { token, userId: user.id, profileId: profile.id, email }
}

export function apiRequest(
  path: string,
  opts: {
    method?: string
    token?: string
    body?: unknown
    idempotencyKey?: string
  } = {},
): Request {
  const headers = new Headers()
  if (opts.token) headers.set('authorization', `Bearer ${opts.token}`)
  if (opts.body !== undefined) headers.set('content-type', 'application/json')
  if (opts.idempotencyKey) headers.set('idempotency-key', opts.idempotencyKey)
  return new Request(`http://localhost:3000${path}`, {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
}
