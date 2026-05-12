# Phase 2A — tRPC Infrastructure + EMIs Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `@phinio/trpc` as the single home of business logic for cross-client consumption. Wire a tRPC catch-all route in `apps/web`, port the `emis` domain end-to-end (procedures, hooks, mutation registry), and delete the old `createServerFn`-based `emis.ts` / `emis.impl.ts`. After this plan ships, the EMI feature behaves identically but every EMI mutation flows through tRPC.

**Architecture:** `packages/trpc` owns the procedures (`router.ts`, `routers/emis.ts`), cross-cutting helpers (`idempotency.ts`, `activity-log.ts`), and the context type. `apps/web` owns the HTTP adapter (`apps/web/src/routes/api/trpc/$.ts`), the context factory that resolves `profileId` via Better Auth, and the React Query tRPC client (`apps/web/src/lib/trpc.ts`). The existing `withIdempotency` + `ProcessedMutation` table powers replay unchanged. Web hooks switch from `createServerFn` calls to `trpc.emis.*` hooks, but **keep their existing `mutationKey` values** so the offline-mutation persistence registry continues to work without churn.

**Tech Stack:** tRPC v11 (`@trpc/server`, `@trpc/client`, `@trpc/react-query`), TanStack Query v5, Better Auth, Prisma 7. SuperJSON transformer (already a dep) for `Date` / `Decimal` round-trip.

**Source spec:** `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §3.
**Branch:** `feat/phase-2a-trpc-emis`, off `feat/phase-1-monorepo`.
**Sibling plans (not in scope):** Phase 2B–G port the other 6 domains using the template proven here.

---

## File Structure (end state)

```
packages/trpc/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    ← re-exports appRouter + AppRouter type
    ├── trpc.ts                     ← initTRPC, transformer, t.router, protectedProcedure
    ├── context.ts                  ← AppContext type def (profileId, prisma, locale)
    ├── idempotency.ts              ← withIdempotency (moved from apps/web/src/server/_idempotency.ts)
    ├── activity-log.ts             ← logActivity, diffFields, fmtText, fmtMoney, fmtDate, getProfileCurrency (moved from apps/web/src/server/activity-log.impl.ts)
    ├── router.ts                   ← appRouter = router({ emis: emisRouter })
    └── routers/
        └── emis.ts                 ← list, get, create, update, delete, markPaymentPaid, complete, upcomingPayments procedures

apps/web/
├── src/
│   ├── lib/
│   │   └── trpc.ts                 ← createTRPCReact<AppRouter>() + httpBatchLink + provider wiring
│   ├── routes/
│   │   └── api/
│   │       └── trpc/
│   │           └── $.ts            ← catch-all GET/POST → fetchRequestHandler
│   ├── server/
│   │   ├── trpc-context.ts         ← createContext(req) — resolves profileId from Better Auth cookie
│   │   ├── emis.ts                 ← DELETED (functionality replaced by tRPC procedures)
│   │   ├── emis.impl.ts            ← DELETED (logic moved into packages/trpc/src/routers/emis.ts)
│   │   ├── _idempotency.ts         ← DELETED (moved to packages/trpc/src/idempotency.ts)
│   │   ├── activity-log.impl.ts    ← DELETED (moved to packages/trpc/src/activity-log.ts); activity-log.ts wrapper deleted too (it's the createServerFn for listActivityImpl; the activity domain port is a later plan, so for Phase 2A we keep that file and update its impl import)
│   │   ├── activity-log.ts         ← (still exists for now; activity domain ports later) — its impl import updates to `@phinio/trpc/activity-log`
│   │   ├── investments.impl.ts     ← still createServerFn-based; imports update to pull idempotency + activity-log from @phinio/trpc
│   │   ├── dashboard.impl.ts       ← same as above (import-only update)
│   │   ├── notifications.impl.ts   ← same
│   │   ├── profile.impl.ts         ← same
│   │   ├── push.impl.ts            ← same
│   │   ├── dev-data.impl.ts        ← same
│   │   └── ...
│   ├── hooks/
│   │   └── useEmis.ts              ← migrated to trpc.emis.* (still 443 lines, keeps mutationKeys)
│   ├── integrations/
│   │   └── tanstack-query/
│   │       ├── root-provider.tsx   ← wraps TRPCProvider around the existing QueryClient
│   │       └── mutation-defaults.ts ← migrate the 5 emi registry entries to call trpc.emis.*.mutationKey() but keep the original mutationKey arrays as-is
│   └── lib/
│       └── prefetch-profile-data.ts ← migrate emi prefetch to trpc.emis.get.prefetch()
```

**Key invariants preserved across the migration:**
- All UUIDs continue to be client-minted for `id` and `clientMutationId`.
- `mutationKey` strings in `mutationKeys` (e.g. `['emis', 'create']`) remain identical — the persisted-mutation registry doesn't need migration.
- `withIdempotency` semantics are unchanged; the function just lives in a new package.
- `Activity` log writes still happen inside the same transaction as the primary write.

---

## Conventions for this plan

- Working directory: `/Users/nahian/Projects/phinio` unless stated otherwise.
- Branch: `feat/phase-2a-trpc-emis` (created off `feat/phase-1-monorepo` in Task 1).
- TDD-strict for the tRPC router (it's new code with concrete behaviors). Refactor tasks (moving idempotency + activity-log into the package) lean on the existing test suite as the regression net.
- Frequent commits — every task ends with one.
- The Phase 1 baseline is **340 tests passing / 0 failing**. Every checkpoint compares against that.

---

## Task 1: Branch + baseline checkpoint

**Files:** none modified.

- [ ] **Step 1: Branch off Phase 1**

```bash
git fetch origin
git switch feat/phase-1-monorepo
git pull --ff-only
git switch -c feat/phase-2a-trpc-emis
```

- [ ] **Step 2: Record the current test/lint/build state**

```bash
pnpm install
pnpm test 2>&1 | tee /tmp/phinio-phase2a-baseline-test.log
pnpm lint 2>&1 | tee /tmp/phinio-phase2a-baseline-lint.log
pnpm build:local 2>&1 | tee /tmp/phinio-phase2a-baseline-build.log
```

Expected: all three exit 0. Test count: 340 passing / 0 failing.

- [ ] **Step 3: Tag the baseline**

```bash
git tag pre-phase-2a-baseline
```

No commit (this is a verification gate).

---

## Task 2: Bootstrap `@phinio/trpc` package skeleton

**Files:**
- Create: `packages/trpc/package.json`
- Create: `packages/trpc/tsconfig.json`
- Create: `packages/trpc/src/index.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/trpc/src/routers
```

- [ ] **Step 2: Create `packages/trpc/package.json`**

```json
{
  "name": "@phinio/trpc",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./idempotency": "./src/idempotency.ts",
    "./activity-log": "./src/activity-log.ts",
    "./context": "./src/context.ts"
  },
  "scripts": {
    "build": "echo 'no build for @phinio/trpc'",
    "build:local": "echo 'no build for @phinio/trpc'",
    "test": "vitest run"
  },
  "dependencies": {
    "@phinio/calc": "workspace:*",
    "@phinio/db": "workspace:*",
    "@phinio/validators": "workspace:*",
    "@trpc/server": "^11.0.0",
    "superjson": "^2.2.6",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 3: Create `packages/trpc/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create a placeholder `packages/trpc/src/index.ts`**

```ts
// Real exports land in Task 3+. This stub lets pnpm wire the package.
export {}
```

- [ ] **Step 5: Install**

```bash
pnpm install
```

Expected: `@trpc/server@^11.0.0` resolves and installs. If it doesn't pick the right version, force-specify by running `pnpm --filter @phinio/trpc add @trpc/server@latest` and proceed.

- [ ] **Step 6: Commit**

```bash
git add packages/trpc pnpm-lock.yaml
git commit -m "feat(trpc): bootstrap @phinio/trpc package skeleton"
```

---

## Task 3: Move `withIdempotency` into `@phinio/trpc/idempotency`

**Files:**
- Move: `apps/web/src/server/_idempotency.ts` → `packages/trpc/src/idempotency.ts`
- Modify: `apps/web/src/server/*.impl.ts` files that import `./_idempotency` (codemod)

- [ ] **Step 1: Inspect the existing file**

```bash
cat apps/web/src/server/_idempotency.ts
```

Confirm it imports only `superjson`, `#/db` (which re-exports from `@phinio/db`), and `@phinio/db` for the `Prisma` namespace. Both can be satisfied from the new location.

- [ ] **Step 2: Move the file**

```bash
git mv apps/web/src/server/_idempotency.ts packages/trpc/src/idempotency.ts
```

- [ ] **Step 3: Adjust imports inside the moved file**

The moved file imports `prisma` via `#/db` (a web-scoped alias). That won't resolve from `packages/trpc`. Replace the import block with package-resolved imports.

Open `packages/trpc/src/idempotency.ts`. Change the top imports from:

```ts
import { prisma } from '#/db'
import { Prisma } from '@phinio/db'
```

to:

```ts
import type { PrismaClient } from '@phinio/db'
import { Prisma } from '@phinio/db'
```

Then update the function signature. The current signature reads (approximately):

```ts
export async function withIdempotency<T>(
  profileId: string,
  clientMutationId: string | undefined,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> { /* uses `prisma.$transaction(...)` */ }
```

Change it to accept the Prisma client as a parameter (or use a module-level setter — pick the simpler form):

```ts
export async function withIdempotency<T>(
  prisma: PrismaClient,
  profileId: string,
  clientMutationId: string | undefined,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  // ...existing body, but use the `prisma` parameter instead of the imported one
}
```

The existing function body references `prisma.$transaction(...)` and `prisma.processedMutation.*`. Those calls still work; only the import source changes.

If the file also exports `type Tx`, leave the existing definition. It should already be derived from `Parameters<...$transaction...>[0]>[0]` and is independent of where `prisma` comes from.

- [ ] **Step 4: Codemod every caller in apps/web**

```bash
cd apps/web
FILES=$(grep -rln --include='*.ts' "from ['\"]\./_idempotency['\"]" src/ 2>/dev/null)
echo "$FILES"
```

For each file, the caller used to pass `(profileId, clientMutationId, fn)` and the prisma client came in via module-level import. Now they must pass `prisma` as the first arg. Update each call site.

In each impl file (e.g. `apps/web/src/server/emis.impl.ts`):

```bash
sed -i '' "s|from './_idempotency'|from '@phinio/trpc/idempotency'|g" src/server/*.impl.ts
```

Then in each impl file, find calls of the form `withIdempotency(profileId, ...)` and change to `withIdempotency(prisma, profileId, ...)`. The impl files already import `prisma` from `#/db`, so the local symbol is available.

Concretely, in each of these files (find with grep):
- `apps/web/src/server/emis.impl.ts`
- `apps/web/src/server/investments.impl.ts`
- (any others surfaced by grep)

Search and replace:

```bash
sed -i '' "s|withIdempotency(profileId,|withIdempotency(prisma, profileId,|g" src/server/*.impl.ts
```

Verify with grep that the replacement only matched the intended sites:

```bash
grep -n "withIdempotency(" src/server/*.impl.ts
```

Every call site should now read `withIdempotency(prisma, profileId, ...)`.

`cd ../..`

- [ ] **Step 5: Type-check + test**

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -E "error" | head -20
pnpm test 2>&1 | tail -10
```

Expected: zero new errors; tests still pass at 340/340.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(trpc): move withIdempotency into @phinio/trpc/idempotency"
```

---

## Task 4: Move activity-log helpers into `@phinio/trpc/activity-log`

**Files:**
- Move: `apps/web/src/server/activity-log.impl.ts` → `packages/trpc/src/activity-log.ts`
- Note: keep `apps/web/src/server/activity-log.ts` (the existing wrapper file) untouched for now — it's the `createServerFn` for the activity-list query, and that domain ports in a later plan. We only need its **impl** to move.

- [ ] **Step 1: Inspect**

```bash
cat apps/web/src/server/activity-log.impl.ts | head -30
```

Note the exports: `logActivity`, `diffFields`, `fmtText`, `fmtMoney`, `fmtDate`, `getProfileCurrency`, `listActivityImpl`, `requireProfileId`.

`requireProfileId` is web-specific (uses `getRequestHeaders` from TanStack Start). **It must NOT move into the package** — leave it behind. Refactor the move accordingly.

- [ ] **Step 2: Move file**

```bash
git mv apps/web/src/server/activity-log.impl.ts packages/trpc/src/activity-log.ts
```

- [ ] **Step 3: Split `requireProfileId` out of the moved file**

Open `packages/trpc/src/activity-log.ts`. Remove the `requireProfileId` export and the corresponding imports (`getRequestHeaders` from `@tanstack/react-start/server`, `auth` from `#/lib/auth`).

Then create `apps/web/src/server/require-profile-id.ts` with the extracted code:

```ts
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'

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
```

- [ ] **Step 4: Fix imports in the moved package file**

Open `packages/trpc/src/activity-log.ts`. Replace any `#/db` imports with `@phinio/db`. Any function that previously used the module-level `prisma` import must accept a Prisma client or `Tx` as a parameter — match the patterns used by callers.

Specifically, `logActivity` is typically called as `logActivity(tx, profileId, entry)` — it already takes `tx` (a transaction client) as its first arg, so this is already package-portable.

`fmtMoney` / `fmtDate` / `fmtText` are pure helpers; no Prisma involvement.

`getProfileCurrency` queries Prisma — change its signature to accept `prisma` as a parameter:

```ts
export async function getProfileCurrency(
  prisma: PrismaClient,
  profileId: string,
): Promise<'BDT' | 'USD'> {
  // ...existing body using `prisma` instead of imported one
}
```

`diffFields` is pure.

`listActivityImpl` queries Prisma — same treatment as `getProfileCurrency`.

- [ ] **Step 5: Codemod callers in apps/web**

```bash
cd apps/web
grep -rln --include='*.ts' "from ['\"]\./activity-log\.impl['\"]" src/
grep -rln --include='*.ts' "from ['\"]\.\./activity-log\.impl['\"]" src/
```

Each match needs:
- `from './activity-log.impl'` → `from '@phinio/trpc/activity-log'`
- `from '../activity-log.impl'` → `from '@phinio/trpc/activity-log'`

```bash
sed -i '' "s|from './activity-log.impl'|from '@phinio/trpc/activity-log'|g" src/server/*.ts src/server/*.impl.ts 2>/dev/null
sed -i '' "s|from '../activity-log.impl'|from '@phinio/trpc/activity-log'|g" $(grep -rl --include='*.ts' "from '../activity-log.impl'" src/)
```

Verify:

```bash
grep -rn "from ['\"]\.\.?/activity-log\.impl['\"]" src/ --include='*.ts'
```

Expected: no matches.

Also: callers of `requireProfileId` (currently `import { requireProfileId } from './activity-log.impl'` or via re-export from each `.impl.ts`) need to switch to the new file:

```bash
grep -rln "requireProfileId" src/server/
```

In each impl file, replace the `requireProfileId` import — it used to come from `'./activity-log.impl'`. Change to:

```ts
import { requireProfileId } from './require-profile-id'
```

(Several impl files re-export `requireProfileId` from their own module — verify each one. If a file does `export { requireProfileId } from './activity-log.impl'`, change to `export { requireProfileId } from './require-profile-id'`.)

Update `getProfileCurrency` callers — pass `prisma` as the first arg.

```bash
grep -n "getProfileCurrency(" src/server/*.impl.ts
```

Each call now needs `getProfileCurrency(prisma, profileId)`.

`cd ../..`

- [ ] **Step 6: Type-check + test**

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -E "error" | head -30
pnpm test 2>&1 | tail -10
```

Expected: zero new errors; 340 tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(trpc): move activity-log helpers into @phinio/trpc/activity-log"
```

---

## Task 5: Define tRPC initTRPC + context type + protectedProcedure

**Files:**
- Create: `packages/trpc/src/context.ts`
- Create: `packages/trpc/src/trpc.ts`
- Create: `packages/trpc/src/__tests__/trpc.test.ts`

- [ ] **Step 1: Create `packages/trpc/src/context.ts`**

```ts
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
  /** Detected locale (en | bn). */
  locale: string
}
```

- [ ] **Step 2: Create `packages/trpc/src/trpc.ts`**

```ts
import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import type { AppContext } from './context.js'

const t = initTRPC.context<AppContext>().create({
  transformer: superjson,
})

export const router = t.router
export const middleware = t.middleware
export const publicProcedure = t.procedure

/**
 * Requires an authenticated profile. The HTTP adapter is responsible for
 * resolving `profileId` from the session cookie / bearer token. If it's
 * null at procedure-call time, we return UNAUTHORIZED rather than letting
 * a downstream Prisma query crash with a confusing "where: { profileId:
 * null }" result.
 */
export const protectedProcedure = t.procedure.use(
  middleware(({ ctx, next }) => {
    if (!ctx.profileId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({ ctx: { ...ctx, profileId: ctx.profileId } })
  }),
)
```

- [ ] **Step 3: Write a failing test for the protectedProcedure narrowing**

Create `packages/trpc/src/__tests__/trpc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc.js'

describe('protectedProcedure', () => {
  it('rejects unauthenticated callers with UNAUTHORIZED', async () => {
    const testRouter = router({
      ping: protectedProcedure.query(({ ctx }) => ctx.profileId),
    })
    const caller = testRouter.createCaller({
      prisma: {} as never,
      profileId: null,
      locale: 'en',
    })
    await expect(caller.ping()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('passes through authenticated callers with non-null profileId', async () => {
    const testRouter = router({
      ping: protectedProcedure.query(({ ctx }) => ctx.profileId),
    })
    const caller = testRouter.createCaller({
      prisma: {} as never,
      profileId: 'profile-123',
      locale: 'en',
    })
    expect(await caller.ping()).toBe('profile-123')
  })
})

// Make sure TRPCError is reachable so future contributors can lean on this import.
void TRPCError
```

- [ ] **Step 4: Run the test — expect PASS (the implementation in Step 2 already satisfies it)**

```bash
pnpm --filter @phinio/trpc test
```

Expected: 2 passing tests. If a test fails, re-read Step 2 and fix.

- [ ] **Step 5: Commit**

```bash
git add packages/trpc
git commit -m "feat(trpc): add initTRPC + AppContext + protectedProcedure"
```

---

## Task 6: Create the empty `appRouter` and exports

**Files:**
- Create: `packages/trpc/src/router.ts`
- Modify: `packages/trpc/src/index.ts`

- [ ] **Step 1: Create `packages/trpc/src/router.ts`**

```ts
import { router } from './trpc.js'

/**
 * Domains land here as we port. For Phase 2A only `emis` is mounted.
 * Subsequent Phase 2 plans add investments, deposits, activity,
 * notifications, profile, push.
 */
export const appRouter = router({})

export type AppRouter = typeof appRouter
```

- [ ] **Step 2: Replace `packages/trpc/src/index.ts`**

```ts
export { appRouter, type AppRouter } from './router.js'
export type { AppContext } from './context.js'
```

- [ ] **Step 3: Verify type-check passes**

```bash
pnpm --filter @phinio/trpc exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add packages/trpc/src
git commit -m "feat(trpc): scaffold empty appRouter + index exports"
```

---

## Task 7: Add tRPC HTTP adapter in `apps/web`

**Files:**
- Create: `apps/web/src/server/trpc-context.ts`
- Create: `apps/web/src/routes/api/trpc/$.ts`
- Modify: `apps/web/package.json` (add `@trpc/server`, `@phinio/trpc` deps)

- [ ] **Step 1: Add deps**

```bash
pnpm --filter @phinio/web add @trpc/server@^11.0.0 @phinio/trpc@workspace:*
```

- [ ] **Step 2: Create `apps/web/src/server/trpc-context.ts`**

```ts
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import type { AppContext } from '@phinio/trpc'
import { getLocaleFn } from './auth'

/**
 * Build a tRPC context from an incoming Request.
 *
 * - profileId resolves from the Better Auth session cookie (web) or
 *   `Authorization: Bearer <token>` header (Phase 3 mobile, same Better
 *   Auth, different transport).
 * - prisma is the shared web prisma client (memoized on globalThis for
 *   HMR survival — see apps/web/src/db.ts).
 * - locale falls back to `en` if detection fails.
 */
export async function createTRPCContext(req: Request): Promise<AppContext> {
  const session = await auth.api.getSession({ headers: req.headers })
  let profileId: string | null = null
  if (session) {
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    profileId = profile?.id ?? null
  }

  let locale = 'en'
  try {
    locale = await getLocaleFn()
  } catch {
    // getLocaleFn relies on RouterContext, which may not be set up for raw
    // RPC; falling back to 'en' is safe — Profile.preferredLanguage is the
    // authoritative source once we read it.
  }

  return { prisma, profileId, locale }
}
```

If `getLocaleFn` doesn't exist at this path, comment out the locale try/catch and hard-code `locale: 'en'` for now (a follow-up plan can wire locale detection). Add a TODO comment naming the follow-up.

- [ ] **Step 3: Create `apps/web/src/routes/api/trpc/$.ts`**

```ts
import { createFileRoute } from '@tanstack/react-router'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@phinio/trpc'
import { createTRPCContext } from '#/server/trpc-context'

export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      GET: ({ request }) =>
        fetchRequestHandler({
          endpoint: '/api/trpc',
          req: request,
          router: appRouter,
          createContext: () => createTRPCContext(request),
        }),
      POST: ({ request }) =>
        fetchRequestHandler({
          endpoint: '/api/trpc',
          req: request,
          router: appRouter,
          createContext: () => createTRPCContext(request),
        }),
    },
  },
})
```

If the exact `createFileRoute` API for server handlers differs in the current TanStack Start version, fall back to the documented catch-all pattern (look at `apps/web/src/routes/api/auth/$.ts` for the working reference) and adapt the handler signatures accordingly. The goal is: GET and POST under `/api/trpc/*` hit `fetchRequestHandler`.

- [ ] **Step 4: Verify the route registers**

```bash
pnpm --filter @phinio/web dev &
DEV_PID=$!
sleep 12
# tRPC's empty router responds 404 to non-procedure paths, but should NOT
# 500. We're just confirming the route is mounted.
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/trpc/nonexistent.thing?batch=1&input=%7B%7D'
kill $DEV_PID 2>/dev/null
```

Expected: a 4xx (likely 404 for unknown procedure or 200 with a tRPC error payload). NOT 500. NOT a connection refused.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/trpc-context.ts apps/web/src/routes/api/trpc apps/web/package.json pnpm-lock.yaml
git commit -m "feat(trpc): mount tRPC catch-all route in apps/web"
```

---

## Task 8: Wire the React Query tRPC client

**Files:**
- Create: `apps/web/src/lib/trpc.ts`
- Modify: `apps/web/src/integrations/tanstack-query/root-provider.tsx`
- Modify: `apps/web/package.json` (add `@trpc/client`, `@trpc/react-query`)

- [ ] **Step 1: Add deps**

```bash
pnpm --filter @phinio/web add @trpc/client@^11.0.0 @trpc/react-query@^11.0.0
```

- [ ] **Step 2: Create `apps/web/src/lib/trpc.ts`**

```ts
import { createTRPCReact, httpBatchLink } from '@trpc/react-query'
import superjson from 'superjson'
import type { AppRouter } from '@phinio/trpc'

export const trpc = createTRPCReact<AppRouter>()

/**
 * Build the tRPC client. Re-built once per QueryClient instance in
 * apps/web/src/integrations/tanstack-query/root-provider.tsx.
 */
export function makeTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        transformer: superjson,
        // The session cookie is browser-managed; bearer-token wiring lands
        // in the Phase 3 mobile plan.
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' })
        },
      }),
    ],
  })
}
```

- [ ] **Step 3: Inspect the existing root provider**

```bash
cat apps/web/src/integrations/tanstack-query/root-provider.tsx | head -80
```

You'll see it constructs a `QueryClient`, optionally restores from a persister, then renders `<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>`.

- [ ] **Step 4: Wrap with `trpc.Provider`**

Edit the root provider. Wherever it currently renders `<QueryClientProvider>`, wrap with the tRPC provider so both share the same `QueryClient`:

```tsx
import { trpc, makeTRPCClient } from '#/lib/trpc'

// Inside the component, after queryClient is built:
const [trpcClient] = useState(() => makeTRPCClient())

return (
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </trpc.Provider>
)
```

If `useState` isn't already imported in this file, add it. If the file isn't a function component (e.g., it's an HOC factory), thread the client through the same way as `queryClient`.

- [ ] **Step 5: Verify build still works**

```bash
pnpm --filter @phinio/web build:local 2>&1 | tail -15
```

Expected: success. If the build complains about `trpc.Provider` missing types, double-check the import: `createTRPCReact<AppRouter>()` returns an object with `.Provider`. The `AppRouter` import must come from `@phinio/trpc`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/trpc.ts apps/web/src/integrations/tanstack-query/root-provider.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(trpc): wire @trpc/react-query client into apps/web root provider"
```

---

## Task 9: Port the `emis` domain into `@phinio/trpc/routers/emis`

**Files:**
- Create: `packages/trpc/src/routers/emis.ts`
- Modify: `packages/trpc/src/router.ts` (mount emis)
- Reference: `apps/web/src/server/emis.impl.ts` (source of business logic)

This is the largest single task in the plan. The strategy: copy the 8 existing impl functions into the new router file as procedures, replacing the `requireProfileId()` call pattern with `ctx.profileId`, replacing `prisma` from `#/db` with `ctx.prisma`, and replacing inputs derived from `await requireProfileId()` with values from `ctx`. Every other line of logic — input parsing, business rules, idempotency wrapping, activity-log writes — stays identical.

- [ ] **Step 1: Read the entire source file once**

```bash
wc -l apps/web/src/server/emis.impl.ts
cat apps/web/src/server/emis.impl.ts
```

Take stock of: the 8 impl functions (`listEmisImpl`, `getEmiImpl`, `createEmiImpl`, `updateEmiImpl`, `deleteEmiImpl`, `markPaymentPaidImpl`, `completeEmiImpl`, `upcomingPaymentsImpl`), the type definitions (`SerializedEmiPayment`, `SerializedEmi`), and the shared imports (`withIdempotency`, `logActivity`, `diffFields`, `fmtText`, `fmtMoney`, `fmtDate`, `getProfileCurrency`, `FEE_PAYMENT_NUMBER`, `calculateEmi`, `generateAmortization`, `isFeePayment`, `isRegularPayment`).

- [ ] **Step 2: Create `packages/trpc/src/routers/emis.ts`**

Replicate the imports, type definitions, and 8 procedures. The shape is:

```ts
import { z } from 'zod'
import { Prisma } from '@phinio/db'
import {
  emiCompleteSchema,
  emiCreateSchema,
  emiIdSchema,
  emiListQuerySchema,
  emiUpdateSchema,
  markPaymentPaidSchema,
} from '@phinio/validators'
import {
  FEE_PAYMENT_NUMBER,
  calculateEmi,
  generateAmortization,
  isFeePayment,
  isRegularPayment,
} from '@phinio/calc'
import { withIdempotency } from '../idempotency.js'
import {
  diffFields,
  fmtText,
  fmtMoney,
  fmtDate,
  getProfileCurrency,
  logActivity,
} from '../activity-log.js'
import { protectedProcedure, router } from '../trpc.js'

// Re-declare the Serialized* types here (copy from emis.impl.ts verbatim)
export interface SerializedEmiPayment { /* ... */ }
export interface SerializedEmi { /* ... */ }

export const emisRouter = router({
  list: protectedProcedure
    .input(emiListQuerySchema)
    .query(async ({ ctx, input }) => {
      // PASTE the body of listEmisImpl, replacing:
      //   - `prisma` (from `#/db`) with `ctx.prisma`
      //   - `profileId` parameter with `ctx.profileId`
    }),

  get: protectedProcedure
    .input(emiIdSchema)
    .query(async ({ ctx, input }) => {
      // PASTE getEmiImpl body, same substitutions; arg is input.emiId
    }),

  create: protectedProcedure
    .input(emiCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE createEmiImpl body
    }),

  update: protectedProcedure
    .input(emiUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE updateEmiImpl body
    }),

  delete: protectedProcedure
    .input(emiIdSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE deleteEmiImpl body
    }),

  markPaymentPaid: protectedProcedure
    .input(markPaymentPaidSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE markPaymentPaidImpl body
    }),

  complete: protectedProcedure
    .input(emiCompleteSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE completeEmiImpl body
    }),

  upcomingPayments: protectedProcedure.query(async ({ ctx }) => {
    // PASTE upcomingPaymentsImpl body (no input)
  }),
})
```

**Concrete substitution rules for each body paste:**

1. Anywhere the impl reads from a parameter named `profileId`, replace with `ctx.profileId`.
2. Anywhere the impl reads from a parameter named `data` (the input bag), use `input` instead.
3. Anywhere the impl imports `prisma` from `#/db`, use `ctx.prisma`.
4. Anywhere the impl calls `withIdempotency(prisma, profileId, ...)`, change to `withIdempotency(ctx.prisma, ctx.profileId, ...)`.
5. Anywhere the impl calls `getProfileCurrency(prisma, profileId)`, change to `getProfileCurrency(ctx.prisma, ctx.profileId)`.
6. Anywhere the impl uses `Prisma.SomeType` from the prisma generated client, the import already pulls from `@phinio/db`, so this is unchanged.

Do this paste-and-substitute methodically — function by function. Keep a checklist:

| Procedure | Bodied? | Substitutions applied? |
| --------- | ------- | ---------------------- |
| list      | [ ]     | [ ]                    |
| get       | [ ]     | [ ]                    |
| create    | [ ]     | [ ]                    |
| update    | [ ]     | [ ]                    |
| delete    | [ ]     | [ ]                    |
| markPaymentPaid | [ ] | [ ]                  |
| complete  | [ ]     | [ ]                    |
| upcomingPayments | [ ] | [ ]                 |

Tick each off as you go.

- [ ] **Step 3: Mount emisRouter in the appRouter**

Edit `packages/trpc/src/router.ts`:

```ts
import { router } from './trpc.js'
import { emisRouter } from './routers/emis.js'

export const appRouter = router({
  emis: emisRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 4: Type-check the package**

```bash
pnpm --filter @phinio/trpc exec tsc --noEmit 2>&1 | head -40
```

Expected: zero errors. Common issues:
- Unresolved imports — verify `@phinio/calc`, `@phinio/db`, `@phinio/validators` are in dependencies (Task 2 added them; double-check `packages/trpc/package.json`).
- Type drift on the `Tx` / `TransactionClient` type — both `idempotency.ts` and `activity-log.ts` should re-export the same `Tx` type; verify they agree.

- [ ] **Step 5: Verify the route serves an emis call end-to-end (smoke test)**

```bash
pnpm --filter @phinio/web dev &
DEV_PID=$!
sleep 12
# This call requires authentication. It should return a tRPC error
# payload (UNAUTHORIZED) — NOT 500, NOT 404.
curl -s 'http://localhost:3000/api/trpc/emis.upcomingPayments?batch=1&input=%7B%7D' | head -c 500
echo
kill $DEV_PID 2>/dev/null
```

Expected: a JSON response containing `"code":"UNAUTHORIZED"` or similar tRPC error envelope. If you get 500, inspect the dev server logs for the actual stack trace and fix.

- [ ] **Step 6: Commit**

```bash
git add packages/trpc/src/routers packages/trpc/src/router.ts
git commit -m "feat(trpc): port emis domain — 8 procedures call into shared idempotency + activity-log"
```

---

## Task 10: Migrate `useEmis.ts` hook to tRPC client

**Files:**
- Modify: `apps/web/src/hooks/useEmis.ts`

This file is 443 lines. The migration is **mechanical**: every `createServerFn` call becomes a tRPC client call, but the surrounding optimistic-update logic and mutation keys stay identical.

- [ ] **Step 1: Add the trpc client import**

At the top of `apps/web/src/hooks/useEmis.ts`, add:

```ts
import { trpc } from '#/lib/trpc'
```

Remove the existing imports of `getEmiFn`, `listEmisFn`, `upcomingPaymentsFn`:

```ts
// DELETE: import { getEmiFn, listEmisFn, upcomingPaymentsFn } from '#/server/emis'
// DELETE: import type { EmiListFilters } from '#/server/emis'
```

Add the type import for `EmiListFilters` from the validators package:

```ts
import type { z } from 'zod'
import type { emiListQuerySchema } from '@phinio/validators'
export type EmiListFilters = z.infer<typeof emiListQuerySchema>
```

(We re-export it here so existing route files that import `EmiListFilters` from `#/hooks/useEmis` continue to work. Verify by grepping who imports `EmiListFilters` from `#/server/emis` and updating those import paths to `#/hooks/useEmis` in this same task.)

- [ ] **Step 2: Migrate queries**

`emisListQueryOptions` currently uses `listEmisFn`. Replace its body:

```ts
export function emisListQueryOptions(filters: EmiListFilters) {
  return trpc.emis.list.queryOptions(filters)
}
```

`useEmisQuery` already wraps `useQuery(emisListQueryOptions(filters))` — unchanged.

`useEmiQuery`:

```ts
export function useEmiQuery(emiId: string) {
  return trpc.emis.get.useQuery({ emiId }, { enabled: Boolean(emiId) })
}
```

`useUpcomingPaymentsQuery`:

```ts
export function useUpcomingPaymentsQuery() {
  return trpc.emis.upcomingPayments.useQuery()
}
```

- [ ] **Step 3: Migrate mutations — keep the existing mutationKey values**

Each `useOfflineMutation({ mutationKey: ..., mutationFn: <createServerFn> })` becomes a tRPC mutation hook with an explicit `mutationKey` override.

Pattern transformation:

```ts
// BEFORE:
return useOfflineMutation<…>({
  mutationKey: mutationKeys.emiCreate,
  prepareVariables: (input) => ({ ...input, id: input.id ?? crypto.randomUUID(), clientMutationId: input.clientMutationId ?? crypto.randomUUID() }),
  mutationFn: (input) => createEmiFn({ data: input }),
  // ...
})
```

```ts
// AFTER:
return trpc.emis.create.useMutation({
  // Keep the existing key so the persisted-mutation rehydration registry
  // in integrations/tanstack-query/mutation-defaults.ts continues to map
  // this mutation to the same defaults across reloads.
  mutationKey: mutationKeys.emiCreate,
  // ...
})
```

The `useOfflineMutation` helper auto-mints `clientMutationId` and the entity `id` via `prepareVariables`. For tRPC's `useMutation`, we need to either:
- Wrap the input ourselves before calling `mutate()` (the call sites can do this), OR
- Keep using `useOfflineMutation` as a thin wrapper around `trpc.emis.create.mutationOptions(...)` — see Step 4.

**Recommended:** keep using `useOfflineMutation` so the offline contract (auto-mint UUIDs + persisted replay) doesn't churn. Swap the `mutationFn` to call `trpc.emis.create.mutationOptions().mutationFn` (or its equivalent), and leave the rest of the wrapper alone.

Concretely:

```ts
import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '#/lib/trpc'

const trpcEmiCreateOpts = trpc.emis.create.mutationOptions()

return useOfflineMutation<…>({
  mutationKey: mutationKeys.emiCreate,
  prepareVariables: (input) => ({ ...input, id: input.id ?? crypto.randomUUID(), clientMutationId: input.clientMutationId ?? crypto.randomUUID() }),
  mutationFn: trpcEmiCreateOpts.mutationFn,
  // ...rest unchanged
})
```

`mutationOptions()` is a tRPC-Query helper that returns `{ mutationFn, mutationKey }` — perfect for use inside `useOfflineMutation`.

Repeat the same swap for:
- `useUpdateEmi` → `trpc.emis.update.mutationOptions()`
- `useDeleteEmi` → `trpc.emis.delete.mutationOptions()`
- `useMarkPayment` → `trpc.emis.markPaymentPaid.mutationOptions()`
- `useCompleteEmi` → `trpc.emis.complete.mutationOptions()`

Verify after each swap that the optimistic update logic (`onMutate`, `onError`, `onSuccess`) doesn't reference removed identifiers (`createEmiFn` etc.).

- [ ] **Step 4: Verify type-check**

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -A 1 "src/hooks/useEmis" | head -30
```

Expected: no errors in this file. If `trpc.emis.X.mutationOptions` isn't recognized, the AppRouter type isn't resolving — confirm the path of `import { trpc } from '#/lib/trpc'` is correct and that `apps/web/src/lib/trpc.ts` exports `trpc` typed as `CreateTRPCReact<AppRouter, ...>`.

- [ ] **Step 5: Run the relevant tests**

```bash
pnpm --filter @phinio/web test 2>&1 | tail -20
```

Expected: 340 passing, 0 failing. The integration tests exercise EMI flows end-to-end and will catch any wiring regression.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useEmis.ts
git commit -m "refactor(emis): migrate useEmis.ts to tRPC client; preserve offline mutation keys"
```

---

## Task 11: Migrate `mutation-defaults.ts` emi entries + `prefetch-profile-data.ts`

**Files:**
- Modify: `apps/web/src/integrations/tanstack-query/mutation-defaults.ts`
- Modify: `apps/web/src/lib/prefetch-profile-data.ts`

- [ ] **Step 1: Open `apps/web/src/integrations/tanstack-query/mutation-defaults.ts`**

The file currently imports from `'#/server/emis'`:

```ts
import { createEmiFn, updateEmiFn, deleteEmiFn, completeEmiFn, markPaymentPaidFn } from '#/server/emis'
```

Each of these is used inside a `setMutationDefaults(mutationKeys.X, { mutationFn: XFn, ... })` call.

Replace the imports with tRPC-derived mutation functions:

```ts
import { trpc } from '#/lib/trpc'
// `mutationOptions()` returns { mutationFn, mutationKey } — same shape we need
const emiCreateOpts = trpc.emis.create.mutationOptions()
const emiUpdateOpts = trpc.emis.update.mutationOptions()
const emiDeleteOpts = trpc.emis.delete.mutationOptions()
const emiCompleteOpts = trpc.emis.complete.mutationOptions()
const emiMarkPaymentPaidOpts = trpc.emis.markPaymentPaid.mutationOptions()
```

Wait — this won't work at module top-level because `trpc.emis.create.mutationOptions()` is a hook helper that needs the React context. Re-read the file's structure.

**If `mutation-defaults.ts` is a module that exports a function** (e.g. `registerMutationDefaults(queryClient: QueryClient)`) called from inside a React component or provider, the trpc client is available via the provider — but only inside the component tree. The current pattern with `mutationFn: createEmiFn` works because `createEmiFn` is just a callable function.

**Resolution:** tRPC v11's `getMutationOptions` from the vanilla client (not the hook) returns the same shape. Use:

```ts
import { makeTRPCClient } from '#/lib/trpc'

export function registerMutationDefaults(queryClient: QueryClient, trpcClient = makeTRPCClient()) {
  queryClient.setMutationDefaults(mutationKeys.emiCreate, {
    mutationFn: (vars) => trpcClient.emis.create.mutate(vars),
  })
  // ...repeat for update, delete, complete, markPaymentPaid
}
```

The caller (root-provider.tsx) currently passes the queryClient; update it to also pass the trpcClient (already constructed in Task 8).

Inspect how `registerMutationDefaults` is currently called and adapt:

```bash
grep -n "registerMutationDefaults\|setMutationDefaults" apps/web/src/integrations/tanstack-query/root-provider.tsx
```

Pass the `trpcClient` (constructed via `makeTRPCClient()` in Task 8) into `registerMutationDefaults`. Update the function signature accordingly.

- [ ] **Step 2: Apply the five emi-domain swaps in `mutation-defaults.ts`**

Find each of the 5 emi setMutationDefaults blocks (search for `mutationKeys.emi` and `mutationKeys.markPaymentPaid`). Replace the `mutationFn` line.

Before:
```ts
queryClient.setMutationDefaults(mutationKeys.emiCreate, {
  mutationFn: (vars) => createEmiFn({ data: vars }),
})
```

After:
```ts
queryClient.setMutationDefaults(mutationKeys.emiCreate, {
  mutationFn: (vars) => trpcClient.emis.create.mutate(vars),
})
```

Apply the same pattern for emiUpdate, emiDelete, emiComplete, markPaymentPaid.

Remove the now-unused `createEmiFn` etc. imports at the top of the file.

- [ ] **Step 3: Update `apps/web/src/lib/prefetch-profile-data.ts`**

```bash
grep -n "getEmiFn\|server/emis" apps/web/src/lib/prefetch-profile-data.ts
```

Replace the import + usage:

```ts
// BEFORE:
import { getEmiFn } from '#/server/emis'
await getEmiFn({ data: { emiId } })

// AFTER:
import { makeTRPCClient } from '#/lib/trpc'
const trpcClient = makeTRPCClient()
await trpcClient.emis.get.query({ emiId })
```

If the file currently constructs a single trpcClient or uses a shared one, prefer reusing it over making a new one per prefetch. The file's design will tell you which to do.

- [ ] **Step 4: Type-check + test**

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | head -20
pnpm test 2>&1 | tail -15
```

Expected: zero new type errors; 340 tests pass.

- [ ] **Step 5: Manual smoke test**

```bash
pnpm --filter @phinio/web dev &
DEV_PID=$!
sleep 12
```

In a browser, log in (use a seeded test account), navigate to `/app/emis`, create an EMI, mark a payment paid, complete an EMI, delete an EMI. Each operation should round-trip cleanly. Watch the dev console for any errors.

```bash
kill $DEV_PID 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/integrations/tanstack-query/mutation-defaults.ts apps/web/src/lib/prefetch-profile-data.ts apps/web/src/integrations/tanstack-query/root-provider.tsx
git commit -m "refactor(emis): switch mutation-defaults registry + prefetch to tRPC client"
```

---

## Task 12: Delete the legacy emis files

**Files:**
- Delete: `apps/web/src/server/emis.ts`
- Delete: `apps/web/src/server/emis.impl.ts`

- [ ] **Step 1: Confirm nothing imports from the legacy files**

```bash
grep -rn "from ['\"]#/server/emis['\"]" apps/web/src --include='*.ts' --include='*.tsx'
grep -rn "from ['\"]\./emis\.impl['\"]\|from ['\"]\./emis['\"]" apps/web/src/server --include='*.ts'
```

Expected: no matches. If there are matches, those consumers were missed in Task 10 or 11 — fix them before deleting.

- [ ] **Step 2: Delete**

```bash
git rm apps/web/src/server/emis.ts apps/web/src/server/emis.impl.ts
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep "Cannot find module" | head
pnpm test 2>&1 | tail -10
```

Expected: zero "Cannot find module" errors; 340 tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(emis): delete legacy createServerFn wrappers (replaced by @phinio/trpc/routers/emis)"
```

---

## Task 13: Final regression gate

**Files:** none modified.

- [ ] **Step 1: Fresh-clone simulation**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules .turbo
pnpm install
```

Expected: postinstall runs db:generate; everything resolves.

- [ ] **Step 2: Full pipeline**

```bash
pnpm test 2>&1 | tee /tmp/phinio-phase2a-test.log | tail -15
pnpm lint 2>&1 | tee /tmp/phinio-phase2a-lint.log | tail -10
pnpm build:local 2>&1 | tee /tmp/phinio-phase2a-build.log | tail -15
```

Expected: all three exit 0. Test count: 340 passing / 0 failing.

- [ ] **Step 3: Compare against the Phase 2A baseline**

```bash
echo "=== Phase 2A baseline ==="
grep -E "Tests" /tmp/phinio-phase2a-baseline-test.log | tail -3
echo "=== Phase 2A final ==="
grep -E "Tests" /tmp/phinio-phase2a-test.log | tail -3
```

Expected: identical 340/0 counts.

- [ ] **Step 4: Manual end-to-end smoke test**

```bash
pnpm --filter @phinio/web dev
```

In a browser, log in. Run through the EMI golden path:
1. Navigate `/app/emis` — list renders, upcoming payments tile populates from `trpc.emis.upcomingPayments`.
2. Tap **New EMI**, fill the form (`/app/emis/new`), submit. Optimistic row appears immediately; detail page renders the schedule.
3. Tap a payment row → mark paid. Optimistic update is instant.
4. Edit the EMI label, save. Confirm change persists after refresh.
5. Complete the EMI from the action menu. Confirm status flips and the row disappears from active list.
6. Delete an active EMI. Confirm cascade (payments deleted) by reading the detail-page 404 after delete.
7. Open DevTools → Network — every action should show a POST to `/api/trpc/emis.X?batch=1` (NOT to `/_serverFn/...`).

If any step fails, fix before declaring DONE.

Kill the dev server.

- [ ] **Step 5: Branch snapshot**

```bash
git log --oneline feat/phase-1-monorepo..HEAD
git diff --stat feat/phase-1-monorepo..HEAD | tail -3
```

- [ ] **Step 6: Open PR**

Push and open the PR via `gh pr create`. The PR target is `main` (with the note that it stacks on the Phase 1 PR — reviewers can either wait for Phase 1 to merge first, or review both together).

```bash
git push -u origin feat/phase-2a-trpc-emis
gh pr create --base main --title "Phase 2A: introduce @phinio/trpc + port EMIs to tRPC" --body "$(cat <<'EOF'
## Summary

Introduces `@phinio/trpc` as the shared business-logic package and migrates the EMI domain end-to-end. Web app's EMI feature now flows through tRPC; the legacy `createServerFn` wrappers are deleted. Stacks on top of the Phase 1 monorepo PR.

Implements Phase 2A of the React Native rollout (`docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §3 — emis pilot).

## What's in this PR

- **`packages/trpc/`** — new workspace package
  - `idempotency.ts` — `withIdempotency` (moved from `apps/web/src/server/_idempotency.ts`)
  - `activity-log.ts` — log helpers (moved from `apps/web/src/server/activity-log.impl.ts`, minus `requireProfileId` which stays web-side)
  - `trpc.ts` — `initTRPC`, `protectedProcedure` with session middleware
  - `context.ts` — `AppContext` type
  - `routers/emis.ts` — 8 procedures (list, get, create, update, delete, markPaymentPaid, complete, upcomingPayments)
  - 2 unit tests for `protectedProcedure` authorization narrowing

- **`apps/web/`** changes
  - `routes/api/trpc/$.ts` — fetch-handler catch-all
  - `server/trpc-context.ts` — context factory (Better Auth → profileId)
  - `lib/trpc.ts` — typed React Query tRPC client
  - `hooks/useEmis.ts` — fully migrated to tRPC (keeps existing mutationKeys → no offline-replay registry churn)
  - `integrations/tanstack-query/mutation-defaults.ts` — emi entries switched to tRPC
  - `lib/prefetch-profile-data.ts` — emi prefetch switched to tRPC
  - `server/emis.ts` + `server/emis.impl.ts` — **deleted**

## Invariants preserved

- All UUIDs continue to be client-minted (offline-safe).
- `clientMutationId` semantics + `ProcessedMutation` table unchanged.
- Activity-log writes still happen inside the same transaction as the primary write.
- Optimistic update logic in `useEmis.ts` is unchanged.
- `mutationKey` values are unchanged → `setMutationDefaults` registry continues to map paused mutations across reloads.

## Test plan

- [x] `pnpm test` — 340 passing / 0 failing
- [x] `pnpm lint` — clean
- [x] `pnpm build:local` — success
- [x] Manual EMI golden path (create → mark paid → edit → complete → delete) all routes through `/api/trpc/emis.*`
- [ ] Manual offline test: kill network mid-create, reconnect, verify replay (verify before merge)

## Not in this PR (next plans)

- Phase 2B–G — port investments, deposits, activity, notifications, profile, push using this same template
- `getLocaleFn` integration into `trpc-context.ts` (currently falls back to `'en'`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage** (against §3 of `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md`):

- ✅ `packages/trpc/src/context.ts` — Task 5.
- ✅ `packages/trpc/src/trpc.ts` (initTRPC, protectedProcedure) — Task 5.
- ✅ `packages/trpc/src/idempotency.ts` (moved from web) — Task 3.
- ✅ `packages/trpc/src/activity-log.ts` (moved from web; minus `requireProfileId`) — Task 4.
- ✅ `packages/trpc/src/router.ts` (appRouter with `emis` mounted) — Tasks 6 + 9.
- ✅ `packages/trpc/src/routers/emis.ts` (8 procedures) — Task 9.
- ✅ `apps/web/src/routes/api/trpc/$.ts` (fetch catch-all) — Task 7.
- ✅ `@trpc/react-query` client integration — Task 8.
- ✅ Auth: session cookie → `ctx.profileId` — Task 7's context factory. Bearer-token path is documented as a Phase 3 concern (mobile plan).
- ✅ Idempotency wrapped in every mutation procedure — Task 9.
- ✅ Migration approach: tRPC alongside createServerFn, port emis first, delete legacy emis files — Tasks 9, 10, 11, 12.
- ⏭️ Locale resolution via `getLocaleFn` — flagged in Task 7 as a follow-up if it doesn't drop in cleanly.
- ⏭️ Domains other than `emis` — explicitly out of scope for Phase 2A.

**Placeholder scan:** searched for "TBD", "TODO", "implement later". The only "TODO" reference is a documented next-PR follow-up about locale detection in Task 7 Step 2 (acceptable — it's a marker for a known-deferred concern, not unfinished work in this plan). No "implement later" or other placeholder language.

**Type / name consistency:**
- `AppContext` shape: `{ prisma, profileId, locale }` — used identically in Tasks 5, 7, 9.
- `withIdempotency` signature: `(prisma, profileId, clientMutationId, fn)` — defined in Task 3, used in Task 9.
- `getProfileCurrency` signature: `(prisma, profileId)` — defined in Task 4, used in Task 9.
- `appRouter` / `AppRouter` type: defined in Task 6, augmented in Task 9 Step 3, consumed by Task 8 (client typing) and Task 7 (server mount).
- `mutationKeys.emiCreate` etc.: unchanged from Phase 1; reused verbatim in Tasks 10 + 11.

**Risks the plan does not eliminate:**
- The `mutation-defaults.ts` migration in Task 11 assumes `makeTRPCClient()` can be called outside React (vanilla client). This is true for tRPC v11, but if `mutation-defaults.ts` is constructed inside a hook context, the implementer should pass the existing trpcClient through rather than make a new one. Task 11 Step 1 names this explicitly.
- The `apps/web/src/routes/api/trpc/$.ts` server-handler API depends on the current TanStack Start version. Task 7 Step 3 cross-references the existing auth catch-all (`apps/web/src/routes/api/auth/$.ts`) as the working reference if the route shape differs from what's documented here.
- The Task 9 paste-and-substitute approach is verbose. If the implementer notices a clearer refactoring opportunity (e.g., extracting shared selector helpers), they should NOT take it in this plan — preserving line-by-line equivalence with the original impls is what makes the regression net trustworthy.
