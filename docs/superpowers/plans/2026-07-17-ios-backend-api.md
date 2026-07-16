# iOS Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Phinio's existing server logic as a versioned REST API (`/api/v1/*`) with bearer auth, a full-snapshot sync endpoint, device-token registration, and APNs reminders — the backend half of the native iOS app (spec: `docs/superpowers/specs/2026-07-17-ios-app-design.md`).

**Architecture:** Each REST route is a TanStack Start file route under `src/routes/api/v1/` whose handlers are thin wrappers around the existing `.impl.ts` functions. Handlers are exported named functions (same pattern as `handleCron` in `src/routes/api/cron/send-reminders.ts`) so integration tests import and call them directly with a `Request`. Shared auth/error/body helpers live in one new module, `src/server/api-v1.ts`.

**Tech Stack:** TanStack Start file routes, Better Auth (`bearer` plugin), Prisma 7, Zod 4, node:http2 + node:crypto for APNs (no new dependencies), Vitest integration tests.

## Global Constraints

- Money is `Decimal(15,2)` in Prisma and MUST serialize as JSON strings, never numbers. Prisma `Decimal` and the impl "Serialized" types already do this — never call `Number()` on a money field.
- Dates serialize as ISO 8601 (automatic via `JSON.stringify` on `Date`).
- Every handler derives `profileId` (or `userId` for profile routes) from the Better Auth session via `requireApiProfile(request)` and passes it to the impl — never trust a client-supplied profile id.
- Error envelope is `{ "error": { "code": string, "message": string } }` with statuses: 400 validation, 401 unauthorized, 404 not found, 422 business-rule rejection, 500 internal.
- The `Idempotency-Key` request header maps to the impls' existing `clientMutationId` field (deduped via `ProcessedMutation`).
- Prisma commands only via npm scripts (`npm run db:generate`, `npm run db:migrate`) — never `npx prisma` directly (they need `dotenv -e .env.local`).
- Route files under `src/routes/api/v1/` are server-only: static imports of prisma/impls are fine (same as `send-reminders.ts`). Never edit `src/routeTree.gen.ts` — it regenerates on `npm run dev`/`npm run build`. `createFileRoute('...')` path literals may type-error until regeneration; Vitest does not typecheck, so tests are unaffected. The final task runs a build.
- Existing code style: no semicolons, single quotes, 2-space indent. Run `npm run check` before every commit.
- Run integration tests with `npx vitest run tests/integration/<file> --project integration` (they need the DB from `globalSetup`).

## File Structure

```
src/lib/auth.ts                                        (modify: + bearer plugin)
src/server/api-v1.ts                                   (new: helpers)
src/server/apns.ts                                     (new: APNs sender)
src/routes/api/v1/
  profile.ts                                           GET, PATCH
  emis.index.ts                                        GET, POST
  emis.upcoming.ts                                     GET
  emis.$emiId.ts                                       GET, PATCH, DELETE
  emis.$emiId.complete.ts                              POST
  emi-payments.$paymentId.mark-paid.ts                 POST
  investments.index.ts                                 GET, POST
  investments.$id.ts                                   GET, PATCH, DELETE
  investments.$id.withdraw.ts                          POST
  investments.savings.ts                               POST
  investments.savings.$id.ts                           PATCH, DELETE
  investments.savings.$id.deposits.ts                  POST
  investments.dps.ts                                   POST
  investments.dps.$id.ts                               PATCH
  investments.dps.$id.close.ts                         POST
  deposits.$depositId.ts                               DELETE
  deposits.$depositId.mark-paid.ts                     POST
  dashboard.ts                                         GET
  activity.ts                                          GET
  notifications.index.ts                               GET
  notifications.unread-count.ts                        GET
  notifications.$id.read.ts                            POST
  notifications.read-all.ts                            POST
  notifications.clear-read.ts                          POST
  device-tokens.ts                                     POST
  device-tokens.$token.ts                              DELETE
  sync.snapshot.ts                                     GET
src/routes/api/cron/send-reminders.ts                  (modify: + APNs branch)
prisma/schema.prisma                                   (modify: + DeviceToken)
tests/integration/helpers/rest.ts                      (new: auth test helper)
tests/integration/helpers/db.ts                        (modify: truncate device_tokens)
tests/integration/api-*.test.ts                        (new: per module)
tests/lib/apns.test.ts                                 (new: JWT unit test)
```

---

### Task 1: Bearer plugin + API helpers + test harness

**Files:**
- Modify: `src/lib/auth.ts` (plugins array, line 114)
- Create: `src/server/api-v1.ts`
- Create: `tests/integration/helpers/rest.ts`
- Test: `tests/integration/api-auth.test.ts`

**Interfaces:**
- Consumes: `auth` (`#/lib/auth`), `prisma` (`#/db`).
- Produces (used by every later task):
  - `requireApiProfile(request: Request): Promise<{ profileId: string; userId: string }>` — throws `ApiError(401)` when unauthenticated.
  - `api(fn: () => Promise<unknown>): Promise<Response>` — runs `fn`, JSON-serializes the result, maps errors to statuses.
  - `readMutationInput(request: Request, extra?: Record<string, unknown>): Promise<Record<string, unknown>>` — parses JSON body (empty → `{}`), merges `Idempotency-Key` header as `clientMutationId`, then merges `extra` (path params) last.
  - `jsonResponse(body: unknown, status?: number): Response`
  - `class ApiError extends Error { status: number; code: string }`
  - Test helpers: `createAuthedUser(overrides?): Promise<{ token, userId, profileId, email }>` and `apiRequest(path, { method?, token?, body?, idempotencyKey? }): Request`.

- [ ] **Step 1: Add the bearer plugin**

In `src/lib/auth.ts`, change the imports and plugins line:

```ts
import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins'
```

and at the bottom:

```ts
  plugins: [bearer(), tanstackStartCookies()],
```

- [ ] **Step 2: Write the failing test**

Create `tests/integration/api-auth.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, api, requireApiProfile } from '#/server/api-v1'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('requireApiProfile', () => {
  it('resolves profileId and userId for a valid bearer token', async () => {
    const user = await createAuthedUser()
    const request = apiRequest('/api/v1/anything', { token: user.token })
    const result = await requireApiProfile(request)
    expect(result.profileId).toBe(user.profileId)
    expect(result.userId).toBe(user.userId)
  })

  it('throws ApiError 401 without a token', async () => {
    const request = apiRequest('/api/v1/anything')
    await expect(requireApiProfile(request)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('throws ApiError 401 for a garbage token', async () => {
    const request = apiRequest('/api/v1/anything', { token: 'not-a-token' })
    await expect(requireApiProfile(request)).rejects.toMatchObject({
      status: 401,
    })
  })
})

describe('api error mapping', () => {
  async function status(fn: () => Promise<unknown>) {
    const res = await api(fn)
    return res.status
  }

  it('serializes a successful result as JSON 200', async () => {
    const res = await api(async () => ({ hello: 'world' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toEqual({ hello: 'world' })
  })

  it('maps ApiError to its status and envelope', async () => {
    const res = await api(async () => {
      throw new ApiError(401, 'unauthorized', 'Unauthorized')
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Unauthorized' },
    })
  })

  it('maps ZodError to 400', async () => {
    const { z } = await import('zod')
    expect(await status(async () => z.string().parse(42))).toBe(400)
  })

  it("maps impl-style 'not found' errors to 404", async () => {
    expect(
      await status(async () => {
        throw new Error('EMI not found')
      }),
    ).toBe(404)
  })

  it("maps impl-style 'Unauthorized' errors to 401", async () => {
    expect(
      await status(async () => {
        throw new Error('Unauthorized')
      }),
    ).toBe(401)
  })

  it('maps business-rule errors to 422', async () => {
    expect(
      await status(async () => {
        throw new Error('Withdrawal amount exceeds current value')
      }),
    ).toBe(422)
  })
})
```

Also create `tests/integration/helpers/rest.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-auth.test.ts --project integration`
Expected: FAIL — `Cannot find module '#/server/api-v1'` (or equivalent).

- [ ] **Step 4: Implement `src/server/api-v1.ts`**

```ts
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
      return jsonResponse(
        { error: { code: 'validation_error', message } },
        400,
      )
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-auth.test.ts --project integration`
Expected: PASS (all 9 tests).

- [ ] **Step 6: Commit**

```bash
npm run check
git add src/lib/auth.ts src/server/api-v1.ts tests/integration/helpers/rest.ts tests/integration/api-auth.test.ts
git commit -m "✨ feat(api): bearer auth plugin + /api/v1 helper layer"
```

---

### Task 2: EMI routes

**Files:**
- Create: `src/routes/api/v1/emis.index.ts`, `src/routes/api/v1/emis.upcoming.ts`, `src/routes/api/v1/emis.$emiId.ts`, `src/routes/api/v1/emis.$emiId.complete.ts`, `src/routes/api/v1/emi-payments.$paymentId.mark-paid.ts`
- Test: `tests/integration/api-emis.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; `listEmisImpl`, `getEmiImpl`, `createEmiImpl`, `updateEmiImpl`, `deleteEmiImpl`, `markPaymentPaidImpl`, `completeEmiImpl`, `upcomingPaymentsImpl` from `#/server/emis.impl` (all `(profileId, data)` except `getEmiImpl(profileId, emiId)` and `upcomingPaymentsImpl(profileId)`); schemas from `#/lib/validators`.
- Produces: HTTP endpoints `GET|POST /api/v1/emis`, `GET /api/v1/emis/upcoming`, `GET|PATCH|DELETE /api/v1/emis/:emiId`, `POST /api/v1/emis/:emiId/complete`, `POST /api/v1/emi-payments/:paymentId/mark-paid`. Exported handlers: `handleListEmis`, `handleCreateEmi`, `handleUpcomingPayments`, `handleGetEmi`, `handleUpdateEmi`, `handleDeleteEmi`, `handleCompleteEmi`, `handleMarkPaymentPaid` — each `(request: Request, <pathParam>?: string) => Promise<Response>`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api-emis.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  handleCreateEmi,
  handleListEmis,
} from '#/routes/api/v1/emis.index'
import {
  handleDeleteEmi,
  handleGetEmi,
  handleUpdateEmi,
} from '#/routes/api/v1/emis.$emiId'
import { handleMarkPaymentPaid } from '#/routes/api/v1/emi-payments.$paymentId.mark-paid'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

const emiBody = {
  label: 'Car loan',
  type: 'bank_loan',
  principal: '100000',
  interestRate: '12',
  tenureMonths: 12,
  startDate: '2026-01-15',
}

describe('EMI REST routes', () => {
  it('POST /emis creates an EMI with its full schedule, money as strings', async () => {
    const user = await createAuthedUser()
    const res = await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: emiBody,
      }),
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(typeof created.principal).toBe('string')
    expect(created.principal).toBe('100000')
    const count = await prisma.emiPayment.count({
      where: { emiId: created.id },
    })
    expect(count).toBe(12)
  })

  it('POST /emis without a token is 401', async () => {
    const res = await handleCreateEmi(
      apiRequest('/api/v1/emis', { method: 'POST', body: emiBody }),
    )
    expect(res.status).toBe(401)
  })

  it('POST /emis with a bad payload is 400', async () => {
    const user = await createAuthedUser()
    const res = await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: { ...emiBody, principal: 'not-money' },
      }),
    )
    expect(res.status).toBe(400)
  })

  it('replays the same Idempotency-Key instead of duplicating', async () => {
    const user = await createAuthedUser()
    const key = crypto.randomUUID()
    const make = () =>
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: emiBody,
        idempotencyKey: key,
      })
    const first = await (await handleCreateEmi(make())).json()
    const second = await (await handleCreateEmi(make())).json()
    expect(second.id).toBe(first.id)
    expect(await prisma.emi.count()).toBe(1)
  })

  it('GET /emis lists own EMIs only and filters by query', async () => {
    const owner = await createAuthedUser()
    const other = await createAuthedUser()
    await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: owner.token,
        body: emiBody,
      }),
    )
    const mine = await (
      await handleListEmis(
        apiRequest('/api/v1/emis?status=active&type=bank_loan', {
          token: owner.token,
        }),
      )
    ).json()
    expect(mine).toHaveLength(1)
    const theirs = await (
      await handleListEmis(apiRequest('/api/v1/emis', { token: other.token }))
    ).json()
    expect(theirs).toHaveLength(0)
  })

  it("GET /emis/:id of another profile's EMI is 404", async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: owner.token,
          body: emiBody,
        }),
      )
    ).json()
    const res = await handleGetEmi(
      apiRequest(`/api/v1/emis/${created.id}`, { token: intruder.token }),
      created.id,
    )
    expect(res.status).toBe(404)
  })

  it('PATCH /emis/:id updates the label', async () => {
    const user = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: user.token,
          body: emiBody,
        }),
      )
    ).json()
    const res = await handleUpdateEmi(
      apiRequest(`/api/v1/emis/${created.id}`, {
        method: 'PATCH',
        token: user.token,
        body: { label: 'Renamed loan' },
      }),
      created.id,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).label).toBe('Renamed loan')
  })

  it('POST /emi-payments/:paymentId/mark-paid marks a payment paid', async () => {
    const user = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: user.token,
          body: emiBody,
        }),
      )
    ).json()
    const payment = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: created.id, paymentNumber: 1 },
    })
    const res = await handleMarkPaymentPaid(
      apiRequest(`/api/v1/emi-payments/${payment.id}/mark-paid`, {
        method: 'POST',
        token: user.token,
        body: { paid: true },
      }),
      payment.id,
    )
    expect(res.status).toBe(200)
    const after = await prisma.emiPayment.findUniqueOrThrow({
      where: { id: payment.id },
    })
    expect(after.status).toBe('paid')
  })

  it('DELETE /emis/:id deletes the EMI', async () => {
    const user = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: user.token,
          body: emiBody,
        }),
      )
    ).json()
    const res = await handleDeleteEmi(
      apiRequest(`/api/v1/emis/${created.id}`, {
        method: 'DELETE',
        token: user.token,
      }),
      created.id,
    )
    expect(res.status).toBe(200)
    expect(await prisma.emi.count()).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-emis.test.ts --project integration`
Expected: FAIL — cannot resolve `#/routes/api/v1/emis.index`.

- [ ] **Step 3: Implement the route files**

`src/routes/api/v1/emis.index.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { emiCreateSchema, emiListQuerySchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { createEmiImpl, listEmisImpl } from '#/server/emis.impl'

export function handleListEmis(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const url = new URL(request.url)
    const query = emiListQuerySchema.parse({
      type: url.searchParams.get('type') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    })
    return listEmisImpl(profileId, query)
  })
}

export function handleCreateEmi(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiCreateSchema.parse(await readMutationInput(request))
    return createEmiImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/emis/')({
  server: {
    handlers: {
      GET: ({ request }) => handleListEmis(request),
      POST: ({ request }) => handleCreateEmi(request),
    },
  },
})
```

`src/routes/api/v1/emis.upcoming.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { upcomingPaymentsImpl } from '#/server/emis.impl'

export function handleUpcomingPayments(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return upcomingPaymentsImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/emis/upcoming')({
  server: {
    handlers: {
      GET: ({ request }) => handleUpcomingPayments(request),
    },
  },
})
```

`src/routes/api/v1/emis.$emiId.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { emiIdSchema, emiUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { deleteEmiImpl, getEmiImpl, updateEmiImpl } from '#/server/emis.impl'

export function handleGetEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return getEmiImpl(profileId, emiId)
  })
}

export function handleUpdateEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiUpdateSchema.parse(
      await readMutationInput(request, { emiId }),
    )
    return updateEmiImpl(profileId, input)
  })
}

export function handleDeleteEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiIdSchema.parse(await readMutationInput(request, { emiId }))
    return deleteEmiImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/emis/$emiId')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetEmi(request, params.emiId),
      PATCH: ({ request, params }) => handleUpdateEmi(request, params.emiId),
      DELETE: ({ request, params }) => handleDeleteEmi(request, params.emiId),
    },
  },
})
```

`src/routes/api/v1/emis.$emiId.complete.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { emiCompleteSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { completeEmiImpl } from '#/server/emis.impl'

export function handleCompleteEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiCompleteSchema.parse(
      await readMutationInput(request, { emiId }),
    )
    return completeEmiImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/emis/$emiId/complete')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleCompleteEmi(request, params.emiId),
    },
  },
})
```

`src/routes/api/v1/emi-payments.$paymentId.mark-paid.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { markPaymentPaidSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { markPaymentPaidImpl } from '#/server/emis.impl'

export function handleMarkPaymentPaid(
  request: Request,
  paymentId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markPaymentPaidSchema.parse(
      await readMutationInput(request, { paymentId }),
    )
    return markPaymentPaidImpl(profileId, input)
  })
}

export const Route = createFileRoute(
  '/api/v1/emi-payments/$paymentId/mark-paid',
)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleMarkPaymentPaid(request, params.paymentId),
    },
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-emis.test.ts --project integration`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/routes/api/v1 tests/integration/api-emis.test.ts
git commit -m "✨ feat(api): EMI REST routes under /api/v1"
```

---

### Task 3: Investment routes

**Files:**
- Create: `src/routes/api/v1/investments.index.ts`, `investments.$id.ts`, `investments.$id.withdraw.ts`, `investments.savings.ts`, `investments.savings.$id.ts`, `investments.savings.$id.deposits.ts`, `investments.dps.ts`, `investments.dps.$id.ts`, `investments.dps.$id.close.ts`, `deposits.$depositId.ts`, `deposits.$depositId.mark-paid.ts` (all under `src/routes/api/v1/`)
- Test: `tests/integration/api-investments.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; from `#/server/investments.impl`: `listInvestmentsImpl(profileId, query)`, `getInvestmentImpl(profileId, id)`, `createInvestmentImpl`, `updateInvestmentImpl`, `deleteInvestmentImpl`, `createDpsInvestmentImpl`, `updateDpsInvestmentImpl`, `markDepositPaidImpl`, `createSavingsInvestmentImpl`, `updateSavingsInvestmentImpl`, `addDepositImpl`, `removeDepositImpl`, `withdrawImpl`, `closeDpsImpl` (all `(profileId, data)`). Note: savings delete uses `deleteInvestmentImpl` (same as the web's `deleteSavingsFn`).
- Produces endpoints:
  - `GET|POST /api/v1/investments` (list w/ `status`,`type` query; POST = generic lump-sum create)
  - `GET|PATCH|DELETE /api/v1/investments/:id`
  - `POST /api/v1/investments/:id/withdraw`
  - `POST /api/v1/investments/savings`, `PATCH|DELETE /api/v1/investments/savings/:id`, `POST /api/v1/investments/savings/:id/deposits`
  - `POST /api/v1/investments/dps`, `PATCH /api/v1/investments/dps/:id`, `POST /api/v1/investments/dps/:id/close`
  - `DELETE /api/v1/deposits/:depositId` (remove savings deposit), `POST /api/v1/deposits/:depositId/mark-paid` (DPS installment)
- Exported handlers (each `(request, <param>?) => Promise<Response>`): `handleListInvestments`, `handleCreateInvestment`, `handleGetInvestment`, `handleUpdateInvestment`, `handleDeleteInvestment`, `handleWithdraw`, `handleCreateSavings`, `handleUpdateSavings`, `handleDeleteSavings`, `handleAddDeposit`, `handleCreateDps`, `handleUpdateDps`, `handleCloseDps`, `handleRemoveDeposit`, `handleMarkDepositPaid`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api-investments.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  handleCreateInvestment,
  handleListInvestments,
} from '#/routes/api/v1/investments.index'
import {
  handleDeleteInvestment,
  handleGetInvestment,
} from '#/routes/api/v1/investments.$id'
import { handleWithdraw } from '#/routes/api/v1/investments.$id.withdraw'
import { handleCreateSavings } from '#/routes/api/v1/investments.savings'
import { handleAddDeposit } from '#/routes/api/v1/investments.savings.$id.deposits'
import { handleCreateDps } from '#/routes/api/v1/investments.dps'
import { handleMarkDepositPaid } from '#/routes/api/v1/deposits.$depositId.mark-paid'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('investment REST routes', () => {
  it('POST /investments creates a lump-sum investment, money as strings', async () => {
    const user = await createAuthedUser()
    const res = await handleCreateInvestment(
      apiRequest('/api/v1/investments', {
        method: 'POST',
        token: user.token,
        body: {
          name: 'Index fund',
          type: 'mutual_fund',
          investedAmount: '50000',
          currentValue: '52000',
          dateOfInvestment: '2026-01-01',
        },
      }),
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(typeof created.investedAmount).toBe('string')
  })

  it('GET /investments filters by query and scopes to the profile', async () => {
    const user = await createAuthedUser()
    const other = await createAuthedUser()
    await handleCreateInvestment(
      apiRequest('/api/v1/investments', {
        method: 'POST',
        token: user.token,
        body: {
          name: 'Gold',
          type: 'gold',
          investedAmount: '10000',
          currentValue: '11000',
          dateOfInvestment: '2026-02-01',
        },
      }),
    )
    const mine = await (
      await handleListInvestments(
        apiRequest('/api/v1/investments?status=active&type=gold', {
          token: user.token,
        }),
      )
    ).json()
    expect(mine).toHaveLength(1)
    const theirs = await (
      await handleListInvestments(
        apiRequest('/api/v1/investments', { token: other.token }),
      )
    ).json()
    expect(theirs).toHaveLength(0)
  })

  it('savings: create, add deposit, then partial withdraw', async () => {
    const user = await createAuthedUser()
    const savings = await (
      await handleCreateSavings(
        apiRequest('/api/v1/investments/savings', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Rainy day',
            startDate: '2026-01-01',
            currentValue: '0',
          },
        }),
      )
    ).json()
    const dep = await handleAddDeposit(
      apiRequest(`/api/v1/investments/savings/${savings.id}/deposits`, {
        method: 'POST',
        token: user.token,
        body: { amount: '5000', depositDate: '2026-02-01' },
      }),
      savings.id,
    )
    expect(dep.status).toBe(200)
    const withdrawal = await handleWithdraw(
      apiRequest(`/api/v1/investments/${savings.id}/withdraw`, {
        method: 'POST',
        token: user.token,
        body: { amount: '2000', withdrawalDate: '2026-03-01' },
      }),
      savings.id,
    )
    expect(withdrawal.status).toBe(200)
  })

  it('withdrawing more than current value is a 422', async () => {
    const user = await createAuthedUser()
    const savings = await (
      await handleCreateSavings(
        apiRequest('/api/v1/investments/savings', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Small pot',
            startDate: '2026-01-01',
            currentValue: '100',
          },
        }),
      )
    ).json()
    const res = await handleWithdraw(
      apiRequest(`/api/v1/investments/${savings.id}/withdraw`, {
        method: 'POST',
        token: user.token,
        body: { amount: '99999', withdrawalDate: '2026-03-01' },
      }),
      savings.id,
    )
    expect(res.status).toBe(422)
  })

  it('dps: create generates the deposit schedule; mark one paid', async () => {
    const user = await createAuthedUser()
    const dps = await (
      await handleCreateDps(
        apiRequest('/api/v1/investments/dps', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Bank DPS',
            monthlyDeposit: '5000',
            tenureMonths: 12,
            interestRate: '6',
            interestType: 'simple',
            startDate: '2026-01-10',
          },
        }),
      )
    ).json()
    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: dps.id },
      orderBy: { dueDate: 'asc' },
    })
    expect(deposits).toHaveLength(12)
    const res = await handleMarkDepositPaid(
      apiRequest(`/api/v1/deposits/${deposits[0].id}/mark-paid`, {
        method: 'POST',
        token: user.token,
        body: { paid: true },
      }),
      deposits[0].id,
    )
    expect(res.status).toBe(200)
  })

  it("GET /investments/:id of someone else's investment is 404", async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    const inv = await (
      await handleCreateInvestment(
        apiRequest('/api/v1/investments', {
          method: 'POST',
          token: owner.token,
          body: {
            name: 'Stocks',
            type: 'stock',
            investedAmount: '1000',
            currentValue: '1000',
            dateOfInvestment: '2026-01-01',
          },
        }),
      )
    ).json()
    const res = await handleGetInvestment(
      apiRequest(`/api/v1/investments/${inv.id}`, { token: intruder.token }),
      inv.id,
    )
    expect(res.status).toBe(404)
  })

  it('DELETE /investments/:id removes it', async () => {
    const user = await createAuthedUser()
    const inv = await (
      await handleCreateInvestment(
        apiRequest('/api/v1/investments', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Crypto',
            type: 'crypto',
            investedAmount: '500',
            currentValue: '400',
            dateOfInvestment: '2026-01-01',
          },
        }),
      )
    ).json()
    const res = await handleDeleteInvestment(
      apiRequest(`/api/v1/investments/${inv.id}`, {
        method: 'DELETE',
        token: user.token,
      }),
      inv.id,
    )
    expect(res.status).toBe(200)
    expect(await prisma.investment.count()).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-investments.test.ts --project integration`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Implement the route files**

`src/routes/api/v1/investments.index.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import {
  investmentCreateSchema,
  investmentListQuerySchema,
} from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  createInvestmentImpl,
  listInvestmentsImpl,
} from '#/server/investments.impl'

export function handleListInvestments(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const url = new URL(request.url)
    const query = investmentListQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
    })
    return listInvestmentsImpl(profileId, query)
  })
}

export function handleCreateInvestment(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentCreateSchema.parse(await readMutationInput(request))
    return createInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/')({
  server: {
    handlers: {
      GET: ({ request }) => handleListInvestments(request),
      POST: ({ request }) => handleCreateInvestment(request),
    },
  },
})
```

`src/routes/api/v1/investments.$id.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { investmentIdSchema, investmentUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  deleteInvestmentImpl,
  getInvestmentImpl,
  updateInvestmentImpl,
} from '#/server/investments.impl'

export function handleGetInvestment(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return getInvestmentImpl(profileId, id)
  })
}

export function handleUpdateInvestment(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentUpdateSchema.parse(
      await readMutationInput(request, { id }),
    )
    return updateInvestmentImpl(profileId, input)
  })
}

export function handleDeleteInvestment(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentIdSchema.parse(
      await readMutationInput(request, { id }),
    )
    return deleteInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetInvestment(request, params.id),
      PATCH: ({ request, params }) =>
        handleUpdateInvestment(request, params.id),
      DELETE: ({ request, params }) =>
        handleDeleteInvestment(request, params.id),
    },
  },
})
```

`src/routes/api/v1/investments.$id.withdraw.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { withdrawalSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { withdrawImpl } from '#/server/investments.impl'

export function handleWithdraw(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = withdrawalSchema.parse(
      await readMutationInput(request, { investmentId: id }),
    )
    return withdrawImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/$id/withdraw')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleWithdraw(request, params.id),
    },
  },
})
```

`src/routes/api/v1/investments.savings.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { savingsCreateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { createSavingsInvestmentImpl } from '#/server/investments.impl'

export function handleCreateSavings(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = savingsCreateSchema.parse(await readMutationInput(request))
    return createSavingsInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/savings')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateSavings(request),
    },
  },
})
```

`src/routes/api/v1/investments.savings.$id.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { investmentIdSchema, savingsUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  deleteInvestmentImpl,
  updateSavingsInvestmentImpl,
} from '#/server/investments.impl'

export function handleUpdateSavings(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = savingsUpdateSchema.parse(
      await readMutationInput(request, { id }),
    )
    return updateSavingsInvestmentImpl(profileId, input)
  })
}

export function handleDeleteSavings(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentIdSchema.parse(
      await readMutationInput(request, { id }),
    )
    // Same impl the web's deleteSavingsFn delegates to.
    return deleteInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/savings/$id')({
  server: {
    handlers: {
      PATCH: ({ request, params }) => handleUpdateSavings(request, params.id),
      DELETE: ({ request, params }) => handleDeleteSavings(request, params.id),
    },
  },
})
```

`src/routes/api/v1/investments.savings.$id.deposits.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { addDepositSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { addDepositImpl } from '#/server/investments.impl'

export function handleAddDeposit(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = addDepositSchema.parse(
      await readMutationInput(request, { investmentId: id }),
    )
    return addDepositImpl(profileId, input)
  })
}

export const Route = createFileRoute(
  '/api/v1/investments/savings/$id/deposits',
)({
  server: {
    handlers: {
      POST: ({ request, params }) => handleAddDeposit(request, params.id),
    },
  },
})
```

`src/routes/api/v1/investments.dps.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { dpsCreateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { createDpsInvestmentImpl } from '#/server/investments.impl'

export function handleCreateDps(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = dpsCreateSchema.parse(await readMutationInput(request))
    return createDpsInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/dps')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateDps(request),
    },
  },
})
```

`src/routes/api/v1/investments.dps.$id.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { dpsUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { updateDpsInvestmentImpl } from '#/server/investments.impl'

export function handleUpdateDps(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = dpsUpdateSchema.parse(
      await readMutationInput(request, { id }),
    )
    return updateDpsInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/dps/$id')({
  server: {
    handlers: {
      PATCH: ({ request, params }) => handleUpdateDps(request, params.id),
    },
  },
})
```

`src/routes/api/v1/investments.dps.$id.close.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { dpsCloseSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { closeDpsImpl } from '#/server/investments.impl'

export function handleCloseDps(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = dpsCloseSchema.parse(
      await readMutationInput(request, { investmentId: id }),
    )
    return closeDpsImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/dps/$id/close')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleCloseDps(request, params.id),
    },
  },
})
```

`src/routes/api/v1/deposits.$depositId.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { removeDepositSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { removeDepositImpl } from '#/server/investments.impl'

export function handleRemoveDeposit(
  request: Request,
  depositId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = removeDepositSchema.parse(
      await readMutationInput(request, { depositId }),
    )
    return removeDepositImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/deposits/$depositId')({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        handleRemoveDeposit(request, params.depositId),
    },
  },
})
```

`src/routes/api/v1/deposits.$depositId.mark-paid.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { markDepositPaidSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { markDepositPaidImpl } from '#/server/investments.impl'

export function handleMarkDepositPaid(
  request: Request,
  depositId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markDepositPaidSchema.parse(
      await readMutationInput(request, { depositId }),
    )
    return markDepositPaidImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/deposits/$depositId/mark-paid')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleMarkDepositPaid(request, params.depositId),
    },
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-investments.test.ts --project integration`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/routes/api/v1 tests/integration/api-investments.test.ts
git commit -m "✨ feat(api): investment REST routes under /api/v1"
```

---

### Task 4: Profile routes

**Files:**
- Create: `src/routes/api/v1/profile.ts`
- Test: `tests/integration/api-profile.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; from `#/server/profile.impl`: `getProfileImpl(userId)`, `updateProfileNameImpl(userId, { fullName, clientMutationId? })`, `updateProfileCurrencyImpl(userId, { preferredCurrency, clientMutationId? })`, `updateProfileLanguageImpl(userId, { preferredLanguage, clientMutationId? })`; `isLocale` from `#/lib/i18n/config`.
- Produces: `GET /api/v1/profile`, `PATCH /api/v1/profile` (partial body: `fullName?`, `preferredCurrency?`, `preferredLanguage?`). Exported handlers `handleGetProfile(request)`, `handlePatchProfile(request)`.

**Idempotency note (important):** the three update impls each call `withIdempotency` keyed on `clientMutationId`. A single PATCH touching two fields with one `Idempotency-Key` would make the second impl call replay the first's cached result and silently skip the update. The handler therefore suffixes the key per field (`<key>:name`, `<key>:currency`, `<key>:language`).

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api-profile.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  handleGetProfile,
  handlePatchProfile,
} from '#/routes/api/v1/profile'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('profile REST routes', () => {
  it('GET /profile returns the caller profile', async () => {
    const user = await createAuthedUser()
    const res = await handleGetProfile(
      apiRequest('/api/v1/profile', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fullName).toBe('Rest Tester')
    expect(body.preferredCurrency).toBe('BDT')
  })

  it('PATCH /profile updates several fields in one call', async () => {
    const user = await createAuthedUser()
    const res = await handlePatchProfile(
      apiRequest('/api/v1/profile', {
        method: 'PATCH',
        token: user.token,
        body: { fullName: 'Renamed Person', preferredCurrency: 'USD' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fullName).toBe('Renamed Person')
    expect(body.preferredCurrency).toBe('USD')
  })

  it('PATCH /profile with the same Idempotency-Key applies both fields (suffixed keys)', async () => {
    const user = await createAuthedUser()
    const key = crypto.randomUUID()
    const make = () =>
      apiRequest('/api/v1/profile', {
        method: 'PATCH',
        token: user.token,
        body: { fullName: 'Twice Patched', preferredLanguage: 'bn' },
        idempotencyKey: key,
      })
    await handlePatchProfile(make())
    const res = await handlePatchProfile(make())
    expect(res.status).toBe(200)
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { id: user.profileId },
    })
    expect(profile.fullName).toBe('Twice Patched')
    expect(profile.preferredLanguage).toBe('bn')
  })

  it('PATCH /profile rejects an unknown language', async () => {
    const user = await createAuthedUser()
    const res = await handlePatchProfile(
      apiRequest('/api/v1/profile', {
        method: 'PATCH',
        token: user.token,
        body: { preferredLanguage: 'xx' },
      }),
    )
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-profile.test.ts --project integration`
Expected: FAIL — cannot resolve `#/routes/api/v1/profile`.

- [ ] **Step 3: Implement `src/routes/api/v1/profile.ts`**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { isLocale } from '#/lib/i18n/config'
import type { Locale } from '#/lib/i18n/config'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  getProfileImpl,
  updateProfileCurrencyImpl,
  updateProfileLanguageImpl,
  updateProfileNameImpl,
} from '#/server/profile.impl'

const profilePatchSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  preferredCurrency: z.enum(['BDT', 'USD']).optional(),
  preferredLanguage: z
    .string()
    .refine(isLocale, { message: 'Unsupported language' })
    .optional(),
  clientMutationId: z.string().min(1).optional(),
})

export function handleGetProfile(request: Request): Promise<Response> {
  return api(async () => {
    const { userId } = await requireApiProfile(request)
    return getProfileImpl(userId)
  })
}

export function handlePatchProfile(request: Request): Promise<Response> {
  return api(async () => {
    const { userId } = await requireApiProfile(request)
    const input = profilePatchSchema.parse(await readMutationInput(request))
    // Each field update is its own withIdempotency call, so one shared key
    // would make the second call replay the first's cached result. Suffix
    // the key per field to keep dedupe correct across retries.
    const key = (suffix: string) =>
      input.clientMutationId ? `${input.clientMutationId}:${suffix}` : undefined
    if (input.fullName !== undefined) {
      await updateProfileNameImpl(userId, {
        fullName: input.fullName,
        clientMutationId: key('name'),
      })
    }
    if (input.preferredCurrency !== undefined) {
      await updateProfileCurrencyImpl(userId, {
        preferredCurrency: input.preferredCurrency,
        clientMutationId: key('currency'),
      })
    }
    if (input.preferredLanguage !== undefined) {
      await updateProfileLanguageImpl(userId, {
        preferredLanguage: input.preferredLanguage as Locale,
        clientMutationId: key('language'),
      })
    }
    return getProfileImpl(userId)
  })
}

export const Route = createFileRoute('/api/v1/profile')({
  server: {
    handlers: {
      GET: ({ request }) => handleGetProfile(request),
      PATCH: ({ request }) => handlePatchProfile(request),
    },
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-profile.test.ts --project integration`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/routes/api/v1/profile.ts tests/integration/api-profile.test.ts
git commit -m "✨ feat(api): profile REST routes under /api/v1"
```

---

### Task 5: Dashboard + activity routes

**Files:**
- Create: `src/routes/api/v1/dashboard.ts`, `src/routes/api/v1/activity.ts`
- Test: `tests/integration/api-dashboard-activity.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; `getDashboardStatsImpl(profileId)` from `#/server/dashboard.impl`; `listActivityImpl(profileId, { cursor?, limit? })` from `#/server/activity-log.impl`.
- Produces: `GET /api/v1/dashboard`; `GET /api/v1/activity?cursor=<id>&limit=<n>`. Exported handlers `handleDashboard(request)`, `handleListActivity(request)`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api-dashboard-activity.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { handleDashboard } from '#/routes/api/v1/dashboard'
import { handleListActivity } from '#/routes/api/v1/activity'
import { handleCreateEmi } from '#/routes/api/v1/emis.index'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('dashboard + activity REST routes', () => {
  it('GET /dashboard returns stats for the caller', async () => {
    const user = await createAuthedUser()
    const res = await handleDashboard(
      apiRequest('/api/v1/dashboard', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    // Shape sanity only — the impl has its own tests.
    expect(body).toBeTypeOf('object')
  })

  it('GET /activity returns entries after a mutation, honouring limit', async () => {
    const user = await createAuthedUser()
    await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: {
          label: 'Logged loan',
          type: 'bank_loan',
          principal: '10000',
          interestRate: '10',
          tenureMonths: 6,
          startDate: '2026-01-01',
        },
      }),
    )
    const res = await handleListActivity(
      apiRequest('/api/v1/activity?limit=5', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items.length).toBeGreaterThan(0)
  })

  it('GET /dashboard without a token is 401', async () => {
    const res = await handleDashboard(apiRequest('/api/v1/dashboard'))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-dashboard-activity.test.ts --project integration`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Implement the route files**

`src/routes/api/v1/dashboard.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { getDashboardStatsImpl } from '#/server/dashboard.impl'

export function handleDashboard(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return getDashboardStatsImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/dashboard')({
  server: {
    handlers: {
      GET: ({ request }) => handleDashboard(request),
    },
  },
})
```

`src/routes/api/v1/activity.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { api, requireApiProfile } from '#/server/api-v1'
import { listActivityImpl } from '#/server/activity-log.impl'

const activityQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export function handleListActivity(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const url = new URL(request.url)
    const query = activityQuerySchema.parse({
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })
    return listActivityImpl(profileId, query)
  })
}

export const Route = createFileRoute('/api/v1/activity')({
  server: {
    handlers: {
      GET: ({ request }) => handleListActivity(request),
    },
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-dashboard-activity.test.ts --project integration`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/routes/api/v1/dashboard.ts src/routes/api/v1/activity.ts tests/integration/api-dashboard-activity.test.ts
git commit -m "✨ feat(api): dashboard + activity REST routes"
```

---

### Task 6: Notification routes

**Files:**
- Create: `src/routes/api/v1/notifications.index.ts`, `notifications.unread-count.ts`, `notifications.$id.read.ts`, `notifications.read-all.ts`, `notifications.clear-read.ts` (under `src/routes/api/v1/`)
- Test: `tests/integration/api-notifications.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; from `#/server/notifications.impl`: `listNotificationsImpl(profileId)`, `unreadNotificationCountImpl(profileId)`, `markNotificationReadImpl(profileId, { id, clientMutationId? })`, `markAllNotificationsReadImpl(profileId, data)`, `clearReadNotificationsImpl(profileId, data)`, `createNotification({ profileId, type, title, body, link, dedupeKey })` (test seeding).
- Produces: `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `POST /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`, `POST /api/v1/notifications/clear-read`. Exported handlers: `handleListNotifications`, `handleUnreadCount`, `handleMarkRead`, `handleMarkAllRead`, `handleClearRead`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api-notifications.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createNotification } from '#/server/notifications.impl'
import { handleListNotifications } from '#/routes/api/v1/notifications.index'
import { handleUnreadCount } from '#/routes/api/v1/notifications.unread-count'
import { handleMarkRead } from '#/routes/api/v1/notifications.$id.read'
import { handleMarkAllRead } from '#/routes/api/v1/notifications.read-all'
import { handleClearRead } from '#/routes/api/v1/notifications.clear-read'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

async function seed(profileId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await createNotification({
      profileId,
      type: 'emi.payment.due',
      title: `Reminder ${i}`,
      body: 'Payment due',
      link: '/app/emis/x',
      dedupeKey: `test-${i}`,
    })
  }
}

describe('notification REST routes', () => {
  it('lists notifications and reports unread count', async () => {
    const user = await createAuthedUser()
    await seed(user.profileId, 3)
    const list = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: user.token }),
      )
    ).json()
    expect(list).toHaveLength(3)
    const count = await (
      await handleUnreadCount(
        apiRequest('/api/v1/notifications/unread-count', {
          token: user.token,
        }),
      )
    ).json()
    expect(count.count).toBe(3)
  })

  it('marks one read, then all read, then clears read', async () => {
    const user = await createAuthedUser()
    await seed(user.profileId, 2)
    const list = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: user.token }),
      )
    ).json()
    const first = list[0]
    const markOne = await handleMarkRead(
      apiRequest(`/api/v1/notifications/${first.id}/read`, {
        method: 'POST',
        token: user.token,
      }),
      first.id,
    )
    expect(markOne.status).toBe(200)
    const markAll = await handleMarkAllRead(
      apiRequest('/api/v1/notifications/read-all', {
        method: 'POST',
        token: user.token,
      }),
    )
    expect(markAll.status).toBe(200)
    const clear = await handleClearRead(
      apiRequest('/api/v1/notifications/clear-read', {
        method: 'POST',
        token: user.token,
      }),
    )
    expect(clear.status).toBe(200)
    const remaining = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: user.token }),
      )
    ).json()
    expect(remaining).toHaveLength(0)
  })

  it("cannot mark another profile's notification read", async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    await seed(owner.profileId, 1)
    const list = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: owner.token }),
      )
    ).json()
    const res = await handleMarkRead(
      apiRequest(`/api/v1/notifications/${list[0].id}/read`, {
        method: 'POST',
        token: intruder.token,
      }),
      list[0].id,
    )
    // The impl scopes by profileId; expect a non-2xx (404 or 422 depending
    // on how the impl reports a missing row).
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-notifications.test.ts --project integration`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 3: Implement the route files**

`src/routes/api/v1/notifications.index.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { listNotificationsImpl } from '#/server/notifications.impl'

export function handleListNotifications(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return listNotificationsImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/notifications/')({
  server: {
    handlers: {
      GET: ({ request }) => handleListNotifications(request),
    },
  },
})
```

`src/routes/api/v1/notifications.unread-count.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { unreadNotificationCountImpl } from '#/server/notifications.impl'

export function handleUnreadCount(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return unreadNotificationCountImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/notifications/unread-count')({
  server: {
    handlers: {
      GET: ({ request }) => handleUnreadCount(request),
    },
  },
})
```

`src/routes/api/v1/notifications.$id.read.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { markNotificationReadSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { markNotificationReadImpl } from '#/server/notifications.impl'

export function handleMarkRead(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markNotificationReadSchema.parse(
      await readMutationInput(request, { id }),
    )
    return markNotificationReadImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/notifications/$id/read')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleMarkRead(request, params.id),
    },
  },
})
```

`src/routes/api/v1/notifications.read-all.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { markAllNotificationsReadSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { markAllNotificationsReadImpl } from '#/server/notifications.impl'

export function handleMarkAllRead(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markAllNotificationsReadSchema.parse(
      await readMutationInput(request),
    )
    return markAllNotificationsReadImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/notifications/read-all')({
  server: {
    handlers: {
      POST: ({ request }) => handleMarkAllRead(request),
    },
  },
})
```

`src/routes/api/v1/notifications.clear-read.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { clearReadNotificationsSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { clearReadNotificationsImpl } from '#/server/notifications.impl'

export function handleClearRead(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = clearReadNotificationsSchema.parse(
      await readMutationInput(request),
    )
    return clearReadNotificationsImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/notifications/clear-read')({
  server: {
    handlers: {
      POST: ({ request }) => handleClearRead(request),
    },
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-notifications.test.ts --project integration`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/routes/api/v1 tests/integration/api-notifications.test.ts
git commit -m "✨ feat(api): notification REST routes under /api/v1"
```

---

### Task 7: Sync snapshot endpoint

**Files:**
- Create: `src/routes/api/v1/sync.snapshot.ts`
- Test: `tests/integration/api-snapshot.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; `prisma` directly (raw rows — Prisma `Decimal.toJSON()` yields strings, `Date` yields ISO, so plain `JSON.stringify` satisfies the wire conventions).
- Produces: `GET /api/v1/sync/snapshot` → `{ serverTime, profile, investments, investmentDeposits, investmentWithdrawals, emis, emiPayments, notifications }`, every collection scoped by `profileId`. Exported handler `handleSnapshot(request)`. This is the iOS SyncEngine's pull endpoint.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api-snapshot.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { handleSnapshot } from '#/routes/api/v1/sync.snapshot'
import { handleCreateEmi } from '#/routes/api/v1/emis.index'
import { handleCreateSavings } from '#/routes/api/v1/investments.savings'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/v1/sync/snapshot', () => {
  it('returns the full dataset scoped to the caller, money as strings', async () => {
    const user = await createAuthedUser()
    const other = await createAuthedUser()
    await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: {
          label: 'Snapshot loan',
          type: 'bank_loan',
          principal: '60000',
          interestRate: '9',
          tenureMonths: 6,
          startDate: '2026-01-01',
        },
      }),
    )
    await handleCreateSavings(
      apiRequest('/api/v1/investments/savings', {
        method: 'POST',
        token: other.token,
        body: { name: 'Other pot', startDate: '2026-01-01', currentValue: '5' },
      }),
    )

    const res = await handleSnapshot(
      apiRequest('/api/v1/sync/snapshot', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const snap = await res.json()

    expect(snap.profile.id).toBe(user.profileId)
    expect(snap.emis).toHaveLength(1)
    expect(snap.emiPayments).toHaveLength(6)
    // Other profile's data must not leak.
    expect(snap.investments).toHaveLength(0)
    // Wire conventions: money strings, ISO dates, serverTime present.
    expect(typeof snap.emis[0].principal).toBe('string')
    expect(typeof snap.emiPayments[0].dueDate).toBe('string')
    expect(new Date(snap.serverTime).getTime()).not.toBeNaN()
  })

  it('is 401 without a token', async () => {
    const res = await handleSnapshot(apiRequest('/api/v1/sync/snapshot'))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-snapshot.test.ts --project integration`
Expected: FAIL — cannot resolve `#/routes/api/v1/sync.snapshot`.

- [ ] **Step 3: Implement `src/routes/api/v1/sync.snapshot.ts`**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { api, requireApiProfile } from '#/server/api-v1'

/**
 * Full-snapshot pull for the iOS sync engine. The dataset is per-profile
 * and small (personal scale), so one wholesale snapshot replaces delta
 * sync entirely: no tombstones, no cursors, deletes come for free.
 * Raw Prisma rows serialize correctly by convention: Decimal → string,
 * Date → ISO 8601.
 */
export function handleSnapshot(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const where = { profileId }
    const [
      profile,
      investments,
      investmentDeposits,
      investmentWithdrawals,
      emis,
      emiPayments,
      notifications,
    ] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { id: profileId } }),
      prisma.investment.findMany({ where }),
      prisma.investmentDeposit.findMany({ where }),
      prisma.investmentWithdrawal.findMany({ where }),
      prisma.emi.findMany({ where }),
      prisma.emiPayment.findMany({ where }),
      prisma.notification.findMany({ where }),
    ])
    return {
      serverTime: new Date().toISOString(),
      profile,
      investments,
      investmentDeposits,
      investmentWithdrawals,
      emis,
      emiPayments,
      notifications,
    }
  })
}

export const Route = createFileRoute('/api/v1/sync/snapshot')({
  server: {
    handlers: {
      GET: ({ request }) => handleSnapshot(request),
    },
  },
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-snapshot.test.ts --project integration`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/routes/api/v1/sync.snapshot.ts tests/integration/api-snapshot.test.ts
git commit -m "✨ feat(api): full-snapshot sync endpoint"
```

---

### Task 8: DeviceToken model + routes

**Files:**
- Modify: `prisma/schema.prisma` (add model + relation on `Profile`)
- Modify: `tests/integration/helpers/db.ts` (truncate list)
- Create: `src/routes/api/v1/device-tokens.ts`, `src/routes/api/v1/device-tokens.$token.ts`
- Test: `tests/integration/api-device-tokens.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers; `prisma`.
- Produces: Prisma model `DeviceToken` (`prisma.deviceToken`); `POST /api/v1/device-tokens` body `{ token: string, platform?: 'ios' }` (upsert on token — re-registering moves the token to the caller's profile); `DELETE /api/v1/device-tokens/:token` (scoped delete, used at logout). Exported handlers `handleRegisterDeviceToken(request)`, `handleDeleteDeviceToken(request, token)`. Task 10's cron branch reads `prisma.deviceToken.findMany({ where: { profileId: { in } } })`.

- [ ] **Step 1: Add the schema model and migrate**

In `prisma/schema.prisma`, add inside `model Profile`'s relation list (after `processedMutations ProcessedMutation[]`):

```prisma
  deviceTokens          DeviceToken[]
```

and after the `PushSubscription` model:

```prisma
// Native (APNs) push targets — one row per installed iOS app instance.
// Separate from PushSubscription because Web Push and APNs payload/handshake
// shapes share nothing but the profile relation.
model DeviceToken {
  id        String   @id @default(uuid())
  profileId String
  profile   Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  token     String   @unique
  platform  String   @default("ios")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([profileId])
  @@map("device_tokens")
}
```

Run: `npm run db:migrate -- --name add_device_tokens` then `npm run db:generate`
Expected: migration created, client regenerated without errors.

- [ ] **Step 2: Add `device_tokens` to the test truncate list**

In `tests/integration/helpers/db.ts`, extend the TRUNCATE statement to start with the new table:

```ts
    `TRUNCATE TABLE "device_tokens", "processed_mutations", "activity_log", "push_subscriptions", "notifications", "emi_payments", "emis", "investment_withdrawals", "investment_deposits", "investments", "profiles", "verification", "account", "session", "user" RESTART IDENTITY CASCADE`,
```

- [ ] **Step 3: Write the failing test**

Create `tests/integration/api-device-tokens.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { handleRegisterDeviceToken } from '#/routes/api/v1/device-tokens'
import { handleDeleteDeviceToken } from '#/routes/api/v1/device-tokens.$token'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('device token REST routes', () => {
  it('registers a token for the caller profile', async () => {
    const user = await createAuthedUser()
    const res = await handleRegisterDeviceToken(
      apiRequest('/api/v1/device-tokens', {
        method: 'POST',
        token: user.token,
        body: { token: 'abc123devicetoken' },
      }),
    )
    expect(res.status).toBe(200)
    const row = await prisma.deviceToken.findUniqueOrThrow({
      where: { token: 'abc123devicetoken' },
    })
    expect(row.profileId).toBe(user.profileId)
    expect(row.platform).toBe('ios')
  })

  it('re-registering the same token moves it to the new profile', async () => {
    const first = await createAuthedUser()
    const second = await createAuthedUser()
    const register = (token: string) => (user: { token: string }) =>
      handleRegisterDeviceToken(
        apiRequest('/api/v1/device-tokens', {
          method: 'POST',
          token: user.token,
          body: { token },
        }),
      )
    await register('shared-device')(first)
    await register('shared-device')(second)
    const rows = await prisma.deviceToken.findMany({
      where: { token: 'shared-device' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].profileId).toBe(second.profileId)
  })

  it('DELETE removes only the caller-owned token', async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    await handleRegisterDeviceToken(
      apiRequest('/api/v1/device-tokens', {
        method: 'POST',
        token: owner.token,
        body: { token: 'delete-me' },
      }),
    )
    const foreign = await handleDeleteDeviceToken(
      apiRequest('/api/v1/device-tokens/delete-me', {
        method: 'DELETE',
        token: intruder.token,
      }),
      'delete-me',
    )
    expect((await foreign.json()).deleted).toBe(0)
    const own = await handleDeleteDeviceToken(
      apiRequest('/api/v1/device-tokens/delete-me', {
        method: 'DELETE',
        token: owner.token,
      }),
      'delete-me',
    )
    expect((await own.json()).deleted).toBe(1)
    expect(await prisma.deviceToken.count()).toBe(0)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-device-tokens.test.ts --project integration`
Expected: FAIL — cannot resolve the route modules.

- [ ] **Step 5: Implement the route files**

`src/routes/api/v1/device-tokens.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { prisma } from '#/db'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'

const registerSchema = z.object({
  token: z.string().min(1).max(200),
  platform: z.literal('ios').default('ios'),
})

export function handleRegisterDeviceToken(
  request: Request,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = registerSchema.parse(await readMutationInput(request))
    // Upsert on token: a device that re-registers after a re-login moves to
    // the new profile instead of duplicating.
    return prisma.deviceToken.upsert({
      where: { token: input.token },
      create: { profileId, token: input.token, platform: input.platform },
      update: { profileId },
    })
  })
}

export const Route = createFileRoute('/api/v1/device-tokens')({
  server: {
    handlers: {
      POST: ({ request }) => handleRegisterDeviceToken(request),
    },
  },
})
```

`src/routes/api/v1/device-tokens.$token.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { api, requireApiProfile } from '#/server/api-v1'

export function handleDeleteDeviceToken(
  request: Request,
  token: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const result = await prisma.deviceToken.deleteMany({
      where: { profileId, token },
    })
    return { deleted: result.count }
  })
}

export const Route = createFileRoute('/api/v1/device-tokens/$token')({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        handleDeleteDeviceToken(request, params.token),
    },
  },
})
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/integration/api-device-tokens.test.ts --project integration`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
npm run check
git add prisma src/routes/api/v1 tests/integration/helpers/db.ts tests/integration/api-device-tokens.test.ts
git commit -m "✨ feat(api): DeviceToken model + registration routes for APNs"
```

---

### Task 9: APNs sender

**Files:**
- Create: `src/server/apns.ts`
- Test: `tests/lib/apns.test.ts` (unit project — no DB needed)

**Interfaces:**
- Consumes: `node:http2`, `node:crypto` only. Env vars: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (p8 PEM; `\n` escapes allowed), `APNS_BUNDLE_ID`, optional `APNS_ENV=development`.
- Produces (consumed by Task 10):
  - `buildApnsConfig(): ApnsConfig | null` (null when env unset — APNs silently disabled)
  - `providerJwt(config: ApnsConfig, now?: number): string` (exported for testing; caches ~50 min)
  - `sendApns(config: ApnsConfig, deviceToken: string, payload: ApnsPayload): Promise<ApnsResult>` where `ApnsPayload = { title: string; body: string; link: string; badge?: number }` and `ApnsResult = { ok: boolean; gone: boolean }` (`gone` = 410/`BadDeviceToken` → caller deletes the row).

**Why node:http2:** APNs only speaks HTTP/2; Node's `fetch` is HTTP/1.1-only, so the sender uses `http2.connect` directly. No SDK dependency.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/apns.test.ts`:

```ts
import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildApnsConfig, providerJwt } from '#/server/apns'
import type { ApnsConfig } from '#/server/apns'

function testConfig(): { config: ApnsConfig; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  return {
    config: {
      keyId: 'TESTKEY123',
      teamId: 'TESTTEAM12',
      privateKey,
      bundleId: 'com.phinio.app',
      host: 'https://api.sandbox.push.apple.com',
    },
    publicKey,
  }
}

describe('providerJwt', () => {
  it('produces a valid ES256 JWT with kid + iss + iat', () => {
    const { config, publicKey } = testConfig()
    const jwt = providerJwt(config, Date.now())
    const [h, p, s] = jwt.split('.')
    expect(s).toBeTruthy()
    const header = JSON.parse(Buffer.from(h, 'base64url').toString())
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    expect(header).toEqual({ alg: 'ES256', kid: 'TESTKEY123' })
    expect(payload.iss).toBe('TESTTEAM12')
    expect(payload.iat).toBeTypeOf('number')
    const valid = verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(s, 'base64url'),
    )
    expect(valid).toBe(true)
  })

  it('reuses the cached token within the refresh window', () => {
    const { config } = testConfig()
    const now = Date.now()
    const a = providerJwt(config, now)
    const b = providerJwt(config, now + 60_000)
    expect(b).toBe(a)
  })
})

describe('buildApnsConfig', () => {
  it('returns null when env vars are missing', () => {
    expect(buildApnsConfig()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/apns.test.ts --project unit`
Expected: FAIL — cannot resolve `#/server/apns`.

- [ ] **Step 3: Implement `src/server/apns.ts`**

```ts
import { createPrivateKey, sign } from 'node:crypto'
import { connect } from 'node:http2'

/**
 * Minimal APNs HTTP/2 sender for EMI/DPS payment reminders (design spec §4).
 * APNs requires HTTP/2 and Node's fetch is HTTP/1.1-only, so this speaks
 * node:http2 directly — ~40 lines instead of an SDK dependency.
 */

export interface ApnsConfig {
  keyId: string
  teamId: string
  privateKey: string
  bundleId: string
  host: string
}

export interface ApnsPayload {
  title: string
  body: string
  link: string
  badge?: number
}

export interface ApnsResult {
  ok: boolean
  gone: boolean
}

export function buildApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const bundleId = process.env.APNS_BUNDLE_ID
  if (!keyId || !teamId || !privateKey || !bundleId) return null
  const host =
    process.env.APNS_ENV === 'development'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com'
  return { keyId, teamId, privateKey, bundleId, host }
}

// APNs provider tokens must be refreshed at most hourly and reused for at
// least 20 minutes; cache for 50.
let cachedJwt: { token: string; expiresAt: number } | null = null

export function providerJwt(config: ApnsConfig, now = Date.now()): string {
  if (cachedJwt && cachedJwt.expiresAt > now) return cachedJwt.token
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  const unsigned = `${b64({ alg: 'ES256', kid: config.keyId })}.${b64({
    iss: config.teamId,
    iat: Math.floor(now / 1000),
  })}`
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  const token = `${unsigned}.${signature}`
  cachedJwt = { token, expiresAt: now + 50 * 60 * 1000 }
  return token
}

export function sendApns(
  config: ApnsConfig,
  deviceToken: string,
  payload: ApnsPayload,
): Promise<ApnsResult> {
  return new Promise((resolve) => {
    const client = connect(config.host)
    client.on('error', () => resolve({ ok: false, gone: false }))
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerJwt(config)}`,
      'apns-topic': config.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })
    let status = 0
    let bodyText = ''
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0)
    })
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      bodyText += chunk
    })
    req.on('error', () => {
      client.close()
      resolve({ ok: false, gone: false })
    })
    req.on('end', () => {
      client.close()
      const gone =
        status === 410 ||
        (status === 400 && bodyText.includes('BadDeviceToken'))
      resolve({ ok: status === 200, gone })
    })
    req.end(
      JSON.stringify({
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: 'default',
          ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
        },
        link: payload.link,
      }),
    )
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/apns.test.ts --project unit`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npm run check
git add src/server/apns.ts tests/lib/apns.test.ts
git commit -m "✨ feat(api): APNs HTTP/2 sender with ES256 provider JWT"
```

---

### Task 10: APNs branch in the reminder cron

**Files:**
- Modify: `src/routes/api/cron/send-reminders.ts` (after the web-push block, before the final `return json(...)` — currently lines 384-427)
- Test: `tests/integration/api-apns-reminders.test.ts`

**Interfaces:**
- Consumes: `buildApnsConfig`, `sendApns` from `#/server/apns` (Task 9); `prisma.deviceToken` (Task 8); the cron's existing `pushJobs` array (`{ profileId, payload: { title, body, link } }`).
- Produces: cron response gains `apnsPushed`, `apnsExpired`, `apnsFailed` counters. Reminders now reach iOS devices; `gone` tokens are deleted. Badge is set to the profile's unread notification count.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api-apns-reminders.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleCron } from '#/routes/api/cron/send-reminders'
import { createTestUser, prisma, resetDb } from './helpers/db'

// Neutralize web push (no VAPID-dependent behaviour under test here) and
// stub APNs so no network is touched.
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}))

const sendApns = vi.fn()
vi.mock('#/server/apns', () => ({
  buildApnsConfig: () => ({
    keyId: 'K',
    teamId: 'T',
    privateKey: 'pem',
    bundleId: 'com.phinio.app',
    host: 'https://api.sandbox.push.apple.com',
  }),
  sendApns: (...args: unknown[]) => sendApns(...args),
}))

const CRON_SECRET = 'test-cron-secret'

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET
  process.env.VAPID_PUBLIC_KEY = 'test-public'
  process.env.VAPID_PRIVATE_KEY = 'test-private'
  process.env.VAPID_SUBJECT = 'mailto:test@phinio.test'
})

function utcToday(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

async function seedDueEmiPayment(profileId: string) {
  const emi = await prisma.emi.create({
    data: {
      profileId,
      label: 'Cron loan',
      type: 'bank_loan',
      principal: '10000',
      interestRate: '10',
      tenureMonths: 1,
      emiAmount: '10083.33',
      startDate: utcToday(),
    },
  })
  await prisma.emiPayment.create({
    data: {
      emiId: emi.id,
      profileId,
      paymentNumber: 1,
      dueDate: utcToday(),
      emiAmount: '10083.33',
      principalComponent: '10000',
      interestComponent: '83.33',
      remainingBalance: '0',
      status: 'upcoming',
    },
  })
}

function cronRequest() {
  return new Request('http://localhost:3000/api/cron/send-reminders', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

beforeEach(async () => {
  await resetDb()
  sendApns.mockReset()
})

describe('cron APNs branch', () => {
  it('sends an APNs push per registered device token', async () => {
    sendApns.mockResolvedValue({ ok: true, gone: false })
    const user = await createTestUser()
    await prisma.deviceToken.create({
      data: { profileId: user.profileId, token: 'device-1' },
    })
    await seedDueEmiPayment(user.profileId)

    const res = await handleCron(cronRequest())
    const body = await res.json()
    expect(body.apnsPushed).toBe(1)
    expect(sendApns).toHaveBeenCalledTimes(1)
    const [, token, payload] = sendApns.mock.calls[0]
    expect(token).toBe('device-1')
    expect(payload.badge).toBe(1)
  })

  it('deletes tokens APNs reports gone', async () => {
    sendApns.mockResolvedValue({ ok: false, gone: true })
    const user = await createTestUser()
    await prisma.deviceToken.create({
      data: { profileId: user.profileId, token: 'stale-token' },
    })
    await seedDueEmiPayment(user.profileId)

    const res = await handleCron(cronRequest())
    const body = await res.json()
    expect(body.apnsExpired).toBe(1)
    expect(await prisma.deviceToken.count()).toBe(0)
  })

  it('profiles with no device tokens produce no APNs sends', async () => {
    const user = await createTestUser()
    await seedDueEmiPayment(user.profileId)
    const res = await handleCron(cronRequest())
    const body = await res.json()
    expect(body.apnsPushed).toBe(0)
    expect(sendApns).not.toHaveBeenCalled()
  })
})
```

(The `beforeAll` env block matches `tests/integration/send-reminders.test.ts:20-25` so `handleCron` passes its `CRON_SECRET` and VAPID config guards.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/api-apns-reminders.test.ts --project integration`
Expected: FAIL — response has no `apnsPushed` field.

- [ ] **Step 3: Implement the cron branch**

In `src/routes/api/cron/send-reminders.ts`:

Add imports at the top:

```ts
import { buildApnsConfig, sendApns } from '#/server/apns'
```

After the web-push block (after the `if (pushJobs.length > 0) { ... }` closing brace) and before the final `return json(...)`, add:

```ts
  // APNs branch — mirrors the web-push dispatch for native iOS devices.
  // Skipped entirely when APNS_* env vars are not configured.
  let apnsPushed = 0
  let apnsExpired = 0
  let apnsFailed = 0
  const apnsConfig = buildApnsConfig()
  if (apnsConfig && pushJobs.length > 0) {
    const profileIds = [...new Set(pushJobs.map((j) => j.profileId))]
    const [tokens, unreadCounts] = await Promise.all([
      prisma.deviceToken.findMany({
        where: { profileId: { in: profileIds } },
      }),
      prisma.notification.groupBy({
        by: ['profileId'],
        where: { profileId: { in: profileIds }, readAt: null },
        _count: { _all: true },
      }),
    ])
    const tokensByProfile = new Map<string, string[]>()
    for (const t of tokens) {
      const list = tokensByProfile.get(t.profileId) ?? []
      list.push(t.token)
      tokensByProfile.set(t.profileId, list)
    }
    const unreadByProfile = new Map(
      unreadCounts.map((c) => [c.profileId, c._count._all]),
    )

    const goneTokens = new Set<string>()
    const apnsResults = await Promise.all(
      pushJobs.flatMap((job) => {
        const deviceTokens = tokensByProfile.get(job.profileId) ?? []
        return deviceTokens.map(async (deviceToken) => {
          const result = await sendApns(apnsConfig, deviceToken, {
            title: job.payload.title,
            body: job.payload.body,
            link: job.payload.link,
            badge: unreadByProfile.get(job.profileId) ?? 0,
          })
          return { deviceToken, result }
        })
      }),
    )
    for (const { deviceToken, result } of apnsResults) {
      if (result.gone) {
        goneTokens.add(deviceToken)
      } else if (result.ok) {
        apnsPushed += 1
      } else {
        apnsFailed += 1
      }
    }
    if (goneTokens.size > 0) {
      const del = await prisma.deviceToken.deleteMany({
        where: { token: { in: [...goneTokens] } },
      })
      apnsExpired = del.count
    }
  }
```

and change the final return to:

```ts
  return json({
    scanned,
    created,
    pushed,
    expired,
    failed,
    apnsPushed,
    apnsExpired,
    apnsFailed,
  })
```

- [ ] **Step 4: Run the new test and the existing cron test**

Run: `npx vitest run tests/integration/api-apns-reminders.test.ts tests/integration/send-reminders.test.ts --project integration`
Expected: PASS — new tests pass and the existing cron suite is unbroken (its assertions on `scanned/created/pushed/expired/failed` still hold; APNs is skipped there because `buildApnsConfig()` returns null without env).

- [ ] **Step 5: Document the env vars**

Add to `.env.local` (values from your Apple Developer account later; leave placeholders commented out) and note in the deploy env (Vercel) when going live:

```
# APNs (native iOS push) — reminders skip APNs when unset
# APNS_KEY_ID=
# APNS_TEAM_ID=
# APNS_PRIVATE_KEY=
# APNS_BUNDLE_ID=com.phinio.app
# APNS_ENV=development
```

- [ ] **Step 6: Commit**

```bash
npm run check
git add src/routes/api/cron/send-reminders.ts tests/integration/api-apns-reminders.test.ts
git commit -m "✨ feat(cron): send EMI/DPS reminders to iOS devices via APNs"
```

---

### Task 11: Full verification + route tree

**Files:**
- Modify (generated): `src/routeTree.gen.ts` (regenerated by the build — do not hand-edit)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all projects pass (unit + integration), including every pre-existing test.

- [ ] **Step 2: Build to regenerate the route tree and typecheck**

Run: `npm run build`
Expected: build succeeds; `src/routeTree.gen.ts` now includes every `/api/v1/*` route; no TS errors from `createFileRoute` path literals.

- [ ] **Step 3: Manual smoke test over real HTTP**

```bash
npm run dev &
sleep 5
# Unauthenticated → 401 envelope
curl -s http://localhost:3000/api/v1/dashboard | head -c 200
# Sign in with an existing dev account to get a bearer token
TOKEN=$(curl -s -D - -o /dev/null -X POST http://localhost:3000/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"<your dev user>","password":"<password>"}' \
  | grep -i '^set-auth-token:' | cut -d' ' -f2 | tr -d '\r')
curl -s http://localhost:3000/api/v1/sync/snapshot -H "authorization: Bearer $TOKEN" | head -c 400
kill %1
```

Expected: first curl returns the 401 error envelope; snapshot returns the profile dataset with string money fields.

- [ ] **Step 4: Commit and lint sweep**

```bash
npm run check
git add -A src docs
git commit -m "✅ chore(api): regenerate route tree; verify /api/v1 end-to-end"
```

---

## Deferred to later plans

- Plan 2 (iOS foundation): Xcode project, SwiftData models, APIClient, Keychain auth, SyncEngine, Swift EMI-calculator port + TS-generated fixtures (the fixture-generation script lands in Plan 2 alongside its consumer).
- Plan 3 (iOS screens): onboarding, tabs, forms, notification client + deep links, TestFlight.
- Cleanup of the abandoned `apps/` + `packages/` directories (spec §7) happens at the start of Plan 2, when `apps/ios/` is created.
