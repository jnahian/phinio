import { ZodError } from 'zod'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'

/**
 * Shared plumbing for the /api/v1 REST layer consumed by the native iOS app.
 * Each route file wraps its impl calls in `api()` and authenticates with
 * `requireApiProfile()`. See docs/superpowers/specs/2026-07-17-ios-app-design.md.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Resolve the caller's profile from the request's session (cookie or bearer
 * token — the bearer plugin makes `getSession` accept both). Bearer is what
 * the iOS app sends.
 */
export async function requireApiProfile(
  request: Request,
): Promise<{ profileId: string; userId: string }> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw new ApiError(401, 'unauthorized', 'Unauthorized')
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!profile) throw new ApiError(401, 'unauthorized', 'Profile not found')
  return { profileId: profile.id, userId: session.user.id }
}

/**
 * Parse the JSON body (empty body → {}), merge the Idempotency-Key header
 * into `clientMutationId` (the field the impls' withIdempotency dedupe
 * expects), then merge `extra` (path params) last so the URL always wins
 * over the body.
 */
export async function readMutationInput(
  request: Request,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  let body: Record<string, unknown> = {}
  const text = await request.text()
  if (text.trim().length > 0) {
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new ApiError(400, 'invalid_json', 'Request body is not valid JSON')
    }
  }
  const idempotencyKey = request.headers.get('idempotency-key')
  return {
    ...body,
    ...(idempotencyKey ? { clientMutationId: idempotencyKey } : {}),
    ...extra,
  }
}

/**
 * Run a handler body, JSON-serialize its return value, and map thrown
 * errors onto HTTP statuses. The impl layer signals errors with plain
 * `Error` messages ("EMI not found", "Unauthorized", business-rule
 * sentences), so mapping is message-based:
 *   ZodError            → 400  (client sent an invalid payload)
 *   "Unauthorized"      → 401
 *   "... not found"     → 404
 *   other plain Error   → 422  (business rule — iOS outbox drops + surfaces)
 *   Prisma/internal     → 500  (iOS outbox retries)
 */
export async function api(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return jsonResponse(await fn())
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonResponse(
        { error: { code: error.code, message: error.message } },
        error.status,
      )
    }
    if (error instanceof ZodError) {
      const message = error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
      return jsonResponse({ error: { code: 'validation_error', message } }, 400)
    }
    if (error instanceof Error) {
      if (error.constructor.name.startsWith('PrismaClient')) {
        console.error('[api-v1] database error:', error)
        return jsonResponse(
          { error: { code: 'internal', message: 'Internal error' } },
          500,
        )
      }
      if (error.message === 'Unauthorized') {
        return jsonResponse(
          { error: { code: 'unauthorized', message: 'Unauthorized' } },
          401,
        )
      }
      if (/not found$/i.test(error.message)) {
        return jsonResponse(
          { error: { code: 'not_found', message: error.message } },
          404,
        )
      }
      return jsonResponse(
        { error: { code: 'rejected', message: error.message } },
        422,
      )
    }
    console.error('[api-v1] unknown error:', error)
    return jsonResponse(
      { error: { code: 'internal', message: 'Internal error' } },
      500,
    )
  }
}
