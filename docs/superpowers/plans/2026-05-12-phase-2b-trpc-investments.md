# Phase 2B — Investments Domain Port to tRPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the investments domain (15 procedures spanning lump-sum investments, DPS, savings, deposits, and withdrawals) onto `@phinio/trpc` using the template proven in Phase 2A. Web hooks, mutation registry, prefetch helpers, and integration tests all migrate. Legacy `investments.ts` + `investments.impl.ts` are deleted at the end. After this plan ships, the investments feature behaves identically but every read/write flows through tRPC.

**Architecture:** Same template as Phase 2A. The `@phinio/trpc` package (created in Phase 2A) already has the primitives (`router`, `protectedProcedure`, `idempotency`, `activity-log`). Phase 2B adds `packages/trpc/src/routers/investments.ts` with 15 procedures mirroring the existing impl functions, mounts it under `appRouter.investments`, then ports every consumer in `apps/web`. Mutation keys are unchanged so the offline-replay registry continues to work without churn.

**Tech Stack:** tRPC v11, TanStack Query v5, Better Auth, Prisma 7. No new dependencies.

**Source spec:** `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §3.
**Branch:** `feat/phase-2b-trpc-investments`, off `feat/phase-2a-trpc-emis`.
**Stacks on:** PR #24 (Phase 2A). When Phase 2A merges, rebase onto main.

---

## Domain surface

The investments domain in `apps/web/src/server/investments.impl.ts` (1041 lines) exports 14 stateful impl functions consumed by 15 `createServerFn` wrappers in `investments.ts`. The 15-vs-14 difference: `deleteInvestmentFn` and `deleteSavingsFn` both call into `deleteInvestmentImpl` (same body, two callers from different UI flows). The tRPC router preserves the 15-procedure surface for API stability.

**Procedures to create on `appRouter.investments`** (verbatim names match the wrapper file's `*Fn` exports minus the `Fn` suffix, plus the standard `.query` / `.mutation` split):

| Procedure | Source impl | Type | Input schema |
| --------- | ----------- | ---- | ------------ |
| `list` | `listInvestmentsImpl` | query | `investmentListQuerySchema` |
| `get` | `getInvestmentImpl` | query | `investmentIdSchema` |
| `create` | `createInvestmentImpl` | mutation | `investmentCreateSchema` |
| `update` | `updateInvestmentImpl` | mutation | `investmentUpdateSchema` |
| `delete` | `deleteInvestmentImpl` | mutation | `investmentIdSchema` |
| `createDps` | `createDpsInvestmentImpl` | mutation | `dpsCreateSchema` |
| `updateDps` | `updateDpsInvestmentImpl` | mutation | `dpsUpdateSchema` |
| `markDepositPaid` | `markDepositPaidImpl` | mutation | `markDepositPaidSchema` |
| `createSavings` | `createSavingsInvestmentImpl` | mutation | `savingsCreateSchema` |
| `updateSavings` | `updateSavingsInvestmentImpl` | mutation | `savingsUpdateSchema` |
| `deleteSavings` | `deleteInvestmentImpl` *(shared body with `delete`)* | mutation | `investmentIdSchema` |
| `addDeposit` | `addDepositImpl` | mutation | `addDepositSchema` |
| `removeDeposit` | `removeDepositImpl` | mutation | `removeDepositSchema` |
| `withdraw` | `withdrawImpl` | mutation | `withdrawalSchema` |
| `closeDps` | `closeDpsImpl` | mutation | `dpsCloseSchema` |

**Apps/web consumers (all migrate in this plan):**
- `apps/web/src/hooks/useInvestments.ts` (628 lines, 3 query hooks + 13 mutation hooks)
- `apps/web/src/integrations/tanstack-query/mutation-defaults.ts` (13 setMutationDefaults entries — all but the 5 emi ones)
- `apps/web/src/lib/prefetch-profile-data.ts` (prefetches investment data)
- `apps/web/tests/integration/investments.test.ts` (1034 lines, 37 tests)
- `apps/web/tests/integration/activity-log.test.ts` (uses `createInvestmentImpl`, `createDpsInvestmentImpl`, `updateInvestmentImpl`, `markDepositPaidImpl` to drive activity-log roundtrip tests — these calls migrate to the tRPC caller too)

The dashboard impl + prefetch helpers may consume the public types `InvestmentListItem`, `InvestmentDetail`, `DepositItem`, `WithdrawalItem` — those types need a new home in the package.

---

## File Structure (end state)

```
packages/trpc/src/
├── routers/
│   ├── emis.ts                    ← unchanged (from Phase 2A)
│   └── investments.ts             ← NEW: 15 procedures + 4 public types
└── router.ts                      ← appRouter mounts `investments` alongside `emis`

apps/web/src/
├── hooks/
│   └── useInvestments.ts          ← queries migrated to tRPC; mutations unchanged (registry path)
├── integrations/tanstack-query/
│   └── mutation-defaults.ts       ← 13 investments entries switched to trpcClient.investments.*
├── lib/
│   └── prefetch-profile-data.ts   ← investment prefetch switched to tRPC
├── server/
│   ├── investments.ts             ← DELETED
│   └── investments.impl.ts        ← DELETED
└── tests/integration/
    ├── investments.test.ts        ← 37 tests migrated to appRouter.createCaller(ctx)
    └── activity-log.test.ts       ← 4 impl call sites migrated to caller
```

---

## Conventions for this plan

- Working directory: `/Users/nahian/Projects/phinio` unless stated.
- Branch: `feat/phase-2b-trpc-investments` (created off `feat/phase-2a-trpc-emis` in Task 1).
- TDD-strict reserved for new code; the existing 26+37 integration tests are the regression net for the port itself.
- Frequent commits — every task ends with one.
- Phase 2B baseline: **340 web + 2 trpc + 2 calc + 2 design-tokens = 346 passing / 0 failing.** Every checkpoint compares against that.
- Where the migration template is identical to Phase 2A (e.g. mechanical body-substitution rules), this plan references the Phase 2A plan rather than restating verbatim.

---

## Task 1: Branch + baseline checkpoint

**Files:** none modified.

- [ ] **Step 1: Branch off Phase 2A**

```bash
git fetch origin
git switch feat/phase-2a-trpc-emis
git pull --ff-only
git switch -c feat/phase-2b-trpc-investments
```

- [ ] **Step 2: Record the current state**

```bash
pnpm install
pnpm test 2>&1 | tee /tmp/phinio-phase2b-baseline-test.log
pnpm lint 2>&1 | tee /tmp/phinio-phase2b-baseline-lint.log
pnpm build:local 2>&1 | tee /tmp/phinio-phase2b-baseline-build.log
```

Expected: all three exit 0. Test summary should show 340/0 in `@phinio/web` (plus 2/0 in `@phinio/trpc`, 2/0 in `@phinio/calc`, 2/0 in `@phinio/design-tokens`).

- [ ] **Step 3: Tag the baseline**

```bash
git tag pre-phase-2b-baseline
```

No commit. Verification gate only.

---

## Task 2: Port investments domain to `@phinio/trpc/routers/investments`

This is the largest single task in the plan. The strategy mirrors Phase 2A Task 9: copy the impl bodies into procedure handlers, then apply three mechanical substitutions throughout each body. Do NOT refactor logic.

**Files:**
- Create: `packages/trpc/src/routers/investments.ts`
- Modify: `packages/trpc/src/router.ts` (mount `investments` alongside `emis`)

**Substitution rules** (identical to Phase 2A Task 9):

| Pattern in source impl | Pattern in tRPC procedure body |
| ---------------------- | ------------------------------ |
| Reference to `profileId` parameter | `ctx.profileId` |
| Reference to `data` parameter | `input` |
| Module-level `import { prisma } from '#/db'` (file-level) | Dropped; use `ctx.prisma` in calls |
| `prisma.foo.findMany(...)` | `ctx.prisma.foo.findMany(...)` |
| `withIdempotency(prisma, profileId, ...)` | `withIdempotency(ctx.prisma, ctx.profileId, ...)` |
| `getProfileCurrency(prisma, profileId)` | `getProfileCurrency(ctx.prisma, ctx.profileId)` |
| `logActivity(tx, profileId, entry)` | Unchanged (closure-local `tx` + `profileId`) |

### Step 1: Read the entire source impl

```bash
wc -l apps/web/src/server/investments.impl.ts
sed -n '1,40p' apps/web/src/server/investments.impl.ts   # imports block
grep -n "^export " apps/web/src/server/investments.impl.ts
```

The 14 exported impl functions and 4 public types (`InvestmentListItem`, `DepositItem`, `WithdrawalItem`, `InvestmentDetail`) all come along. `requireProfileId` already lives at `apps/web/src/server/require-profile-id.ts` and is not part of this move.

Also read the schemas the wrapper uses:

```bash
grep -n "investmentCreateSchema\|investmentUpdateSchema\|investmentListQuerySchema\|investmentIdSchema\|dpsCreateSchema\|dpsUpdateSchema\|dpsCloseSchema\|savingsCreateSchema\|savingsUpdateSchema\|markDepositPaidSchema\|addDepositSchema\|removeDepositSchema\|withdrawalSchema" apps/web/src/server/investments.ts
```

Confirm all 13 schema names exist in `@phinio/validators`. If any is missing, stop and report — the schema should already be there.

### Step 2: Create `packages/trpc/src/routers/investments.ts` skeleton

Start with imports (adjust to match what the source impl actually uses):

```ts
import { z } from 'zod'
import { Prisma } from '@phinio/db'
import {
  addDepositSchema,
  dpsCloseSchema,
  dpsCreateSchema,
  dpsUpdateSchema,
  investmentCreateSchema,
  investmentIdSchema,
  investmentListQuerySchema,
  investmentUpdateSchema,
  markDepositPaidSchema,
  removeDepositSchema,
  savingsCreateSchema,
  savingsUpdateSchema,
  withdrawalSchema,
} from '@phinio/validators'
import { withIdempotency } from '../idempotency.js'
import {
  diffFields,
  fmtDate,
  fmtMoney,
  fmtText,
  getProfileCurrency,
  logActivity,
} from '../activity-log.js'
import { protectedProcedure, router } from '../trpc.js'
```

Drop unused imports from the source impl (notably anything the impl pulls from `#/db`, `#/lib/auth`, or other web-specific paths — those are handled via `ctx`).

Then port the **4 public types verbatim** from the source impl (line ~62-211 of `apps/web/src/server/investments.impl.ts`):
- `InvestmentListItem`
- `DepositItem`
- `WithdrawalItem`
- `InvestmentDetail`

Then port any internal (non-exported) helper functions the source impl uses. They come along unchanged.

### Step 3: Port the 15 procedures

Build the router incrementally, one procedure at a time. After each, save the file and `tsc --noEmit` to catch immediate breakage.

Procedure-by-procedure checklist:

| # | Procedure | Source impl | Verb | Bodied | Substitutions verified |
| - | --------- | ----------- | ---- | ------ | ---------------------- |
| 1 | `list` | `listInvestmentsImpl` | `.query` | [ ] | [ ] |
| 2 | `get` | `getInvestmentImpl` | `.query` | [ ] | [ ] |
| 3 | `create` | `createInvestmentImpl` | `.mutation` | [ ] | [ ] |
| 4 | `update` | `updateInvestmentImpl` | `.mutation` | [ ] | [ ] |
| 5 | `delete` | `deleteInvestmentImpl` | `.mutation` | [ ] | [ ] |
| 6 | `createDps` | `createDpsInvestmentImpl` | `.mutation` | [ ] | [ ] |
| 7 | `updateDps` | `updateDpsInvestmentImpl` | `.mutation` | [ ] | [ ] |
| 8 | `markDepositPaid` | `markDepositPaidImpl` | `.mutation` | [ ] | [ ] |
| 9 | `createSavings` | `createSavingsInvestmentImpl` | `.mutation` | [ ] | [ ] |
| 10 | `updateSavings` | `updateSavingsInvestmentImpl` | `.mutation` | [ ] | [ ] |
| 11 | `deleteSavings` | `deleteInvestmentImpl` *(shared body with `delete`)* | `.mutation` | [ ] | [ ] |
| 12 | `addDeposit` | `addDepositImpl` | `.mutation` | [ ] | [ ] |
| 13 | `removeDeposit` | `removeDepositImpl` | `.mutation` | [ ] | [ ] |
| 14 | `withdraw` | `withdrawImpl` | `.mutation` | [ ] | [ ] |
| 15 | `closeDps` | `closeDpsImpl` | `.mutation` | [ ] | [ ] |

Final shape (skeleton — fill in bodies):

```ts
// Public types (copied verbatim from source impl)
export interface InvestmentListItem { /* ... */ }
export interface DepositItem { /* ... */ }
export interface WithdrawalItem { /* ... */ }
export interface InvestmentDetail { /* ... */ }

// Internal helpers (copied verbatim if any exist in source)

export const investmentsRouter = router({
  list: protectedProcedure
    .input(investmentListQuerySchema)
    .query(async ({ ctx, input }) => {
      // PASTE listInvestmentsImpl body
    }),

  get: protectedProcedure
    .input(investmentIdSchema)
    .query(async ({ ctx, input }) => {
      // PASTE getInvestmentImpl body. Source takes `(profileId, id: string)`;
      // procedure receives `{ id }` (or whatever investmentIdSchema's shape is —
      // verify against `@phinio/validators`). Adapt the body's reference to `id`.
    }),

  create: protectedProcedure
    .input(investmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE createInvestmentImpl body
    }),

  update: protectedProcedure
    .input(investmentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE updateInvestmentImpl body
    }),

  delete: protectedProcedure
    .input(investmentIdSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE deleteInvestmentImpl body
    }),

  createDps: protectedProcedure
    .input(dpsCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE createDpsInvestmentImpl body
    }),

  updateDps: protectedProcedure
    .input(dpsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE updateDpsInvestmentImpl body
    }),

  markDepositPaid: protectedProcedure
    .input(markDepositPaidSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE markDepositPaidImpl body
    }),

  createSavings: protectedProcedure
    .input(savingsCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE createSavingsInvestmentImpl body
    }),

  updateSavings: protectedProcedure
    .input(savingsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE updateSavingsInvestmentImpl body
    }),

  deleteSavings: protectedProcedure
    .input(investmentIdSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE deleteInvestmentImpl body — SAME body as `delete` procedure above.
      // Keeping them as two distinct procedures preserves the existing API
      // surface for separate UI deletion flows. If you prefer DRY, you can
      // factor the body into a local helper function, but that's optional.
    }),

  addDeposit: protectedProcedure
    .input(addDepositSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE addDepositImpl body
    }),

  removeDeposit: protectedProcedure
    .input(removeDepositSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE removeDepositImpl body
    }),

  withdraw: protectedProcedure
    .input(withdrawalSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE withdrawImpl body
    }),

  closeDps: protectedProcedure
    .input(dpsCloseSchema)
    .mutation(async ({ ctx, input }) => {
      // PASTE closeDpsImpl body
    }),
})
```

### Step 4: Mount `investmentsRouter` in `appRouter`

Edit `packages/trpc/src/router.ts`:

```ts
import { router } from './trpc.js'
import { emisRouter } from './routers/emis.js'
import { investmentsRouter } from './routers/investments.js'

export const appRouter = router({
  emis: emisRouter,
  investments: investmentsRouter,
})

export type AppRouter = typeof appRouter
```

### Step 5: Type-check the package

```bash
pnpm --filter @phinio/trpc exec tsc --noEmit 2>&1 | tee /tmp/p2b2-trpc-tsc.log | head -60
```

Expected: zero errors. Common issues:
- "Cannot find module" for a schema → verify the name against `@phinio/validators`'s exports (`grep -n "^export " packages/validators/src/index.ts`).
- Type drift on `Prisma.SomeInput` → confirm `Prisma` is imported from `@phinio/db` at the top.
- Body references a helper that wasn't ported (an internal non-exported helper) → copy that helper too.

Fix every error before moving on. Re-run `tsc` after each fix.

### Step 6: Type-check apps/web (which sees AppRouter via the trpc client)

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -E "error TS" | head
```

Expected: only the 5 pre-existing baseline errors (profile.tsx unused imports, auth.ts header types). No new errors.

### Step 7: Smoke-test the route via curl

```bash
pnpm --filter @phinio/web dev &
DEV_PID=$!
sleep 15
curl -s 'http://localhost:3000/api/trpc/investments.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%7D%7D%7D' | head -c 400
echo
kill $DEV_PID 2>/dev/null
wait $DEV_PID 2>/dev/null || true
```

Expected: a JSON envelope containing `"code":"UNAUTHORIZED"` (no session cookie). NOT 500.

### Step 8: Run existing tests

```bash
pnpm test 2>&1 | tail -15
```

Expected: 346 passing / 0 failing (no change yet — the procedures exist but no caller has been migrated; the integration tests still hit the legacy impl which is unchanged).

### Step 9: Commit

```bash
git status
git add packages/trpc/src/routers/investments.ts packages/trpc/src/router.ts
git commit -m "feat(trpc): port investments domain — 15 procedures call into shared idempotency + activity-log"
git status
```

---

## Task 3: Migrate `useInvestments.ts` queries to tRPC

The 3 query hooks (`useInvestmentsQuery`, `useInvestmentQuery`, `investmentsListQueryOptions`) directly call `*Fn` server functions. Migrate them to `trpc.investments.*.queryOptions(...)`. Mutations stay on the registry path (Task 4 swaps the registry).

**Files:**
- Modify: `apps/web/src/hooks/useInvestments.ts`
- Modify: any file that imports `InvestmentListFilters` from `#/server/investments`

### Step 1: Inspect

```bash
head -55 apps/web/src/hooks/useInvestments.ts
grep -n "Fn\b" apps/web/src/hooks/useInvestments.ts | head -20
```

You'll see imports of `listInvestmentsFn`, `getInvestmentFn`, plus `InvestmentListFilters` (type) from `#/server/investments`.

### Step 2: Update imports at the top of `apps/web/src/hooks/useInvestments.ts`

Remove all `*Fn` imports from `#/server/investments` and the `InvestmentListFilters` type import.

Add:

```ts
import type { z } from 'zod'
import type { investmentListQuerySchema } from '@phinio/validators'
import { useTRPC, makeTRPC } from '#/lib/trpc'
import type { inferProcedureOutput } from '@trpc/server'
import type { AppRouter } from '@phinio/trpc'
import type { QueryClient } from '@tanstack/react-query'
```

Re-export `InvestmentListFilters` so existing route loaders / dashboard consumers don't need to change their import path:

```ts
export type InvestmentListFilters = z.infer<typeof investmentListQuerySchema>
```

(Place near the existing `investmentKeys = ...` block.)

### Step 3: Migrate the 3 query hooks

**`investmentsListQueryOptions`** — must remain callable from non-React contexts (route loaders use it). Mirror the pattern used in Phase 2A for `emisListQueryOptions`:

```ts
export function investmentsListQueryOptions(
  queryClient: QueryClient,
  filters: InvestmentListFilters,
) {
  return makeTRPC(queryClient).investments.list.queryOptions(filters)
}
```

**`useInvestmentsQuery`**:

```ts
export function useInvestmentsQuery(filters: InvestmentListFilters) {
  const trpc = useTRPC()
  return useQuery(trpc.investments.list.queryOptions(filters))
}
```

**`useInvestmentQuery`**:

```ts
export function useInvestmentQuery(id: string) {
  const trpc = useTRPC()
  return useQuery({
    ...trpc.investments.get.queryOptions({ id }),
    enabled: Boolean(id),
  })
}
```

(Adjust the input key if `investmentIdSchema` uses something other than `id` — check the schema in `packages/validators/src/index.ts`.)

### Step 4: Fix type derivations that referenced removed `*Fn` symbols

Search inside `useInvestments.ts` for patterns like `Awaited<ReturnType<typeof getInvestmentFn>>` or `Awaited<ReturnType<typeof listInvestmentsFn>>`. Replace with the tRPC-derived equivalents:

```ts
type InvestmentDetailShape = inferProcedureOutput<AppRouter['investments']['get']>
type ListShape = inferProcedureOutput<AppRouter['investments']['list']>
```

Apply consistently throughout the file.

### Step 5: Update consumers of `InvestmentListFilters`

```bash
grep -rn "import type { InvestmentListFilters } from '#/server/investments'" apps/web/src --include='*.ts' --include='*.tsx'
```

For each match, redirect to the re-export:

```bash
sed -i '' "s|import type { InvestmentListFilters } from '#/server/investments'|import type { InvestmentListFilters } from '#/hooks/useInvestments'|g" $(grep -rl --include='*.ts' --include='*.tsx' "import type { InvestmentListFilters } from '#/server/investments'" apps/web/src 2>/dev/null)
```

Also update non-React callers of `investmentsListQueryOptions` to pass `queryClient`:

```bash
grep -rn "investmentsListQueryOptions(" apps/web/src --include='*.ts' --include='*.tsx'
```

Anywhere it's called without a `queryClient` arg, fix the call.

### Step 6: Type-check

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: 5 pre-existing baseline errors, no new ones.

### Step 7: Run tests

```bash
pnpm test 2>&1 | tail -15
```

Expected: 346 passing. (No test changes yet — integration tests still target the legacy impl directly.)

### Step 8: Commit

```bash
git status
git add apps/web/src/hooks/useInvestments.ts $(git diff --name-only apps/web/src/)
git commit -m "refactor(investments): migrate useInvestments queries to tRPC (mutations stay on registry)"
git status
```

---

## Task 4: Migrate `mutation-defaults.ts` + `prefetch-profile-data.ts` to the tRPC client

13 `setMutationDefaults` entries — all the non-emi investments-related entries (investmentCreate, investmentUpdate, investmentDelete, dpsCreate, dpsUpdate, dpsClose, markDepositPaid, savingsCreate, savingsUpdate, savingsDelete, addDeposit, removeDeposit, withdraw). Plus the investments-related prefetches.

**Files:**
- Modify: `apps/web/src/integrations/tanstack-query/mutation-defaults.ts`
- Modify: `apps/web/src/lib/prefetch-profile-data.ts`

### Step 1: Inspect `mutation-defaults.ts`

```bash
grep -n "investmentCreate\|investmentUpdate\|investmentDelete\|dpsCreate\|dpsUpdate\|dpsClose\|markDepositPaid\|savingsCreate\|savingsUpdate\|savingsDelete\|addDeposit\|removeDeposit\|withdraw" apps/web/src/integrations/tanstack-query/mutation-defaults.ts | head -30
```

### Step 2: Swap the 13 investments entries

Edit `apps/web/src/integrations/tanstack-query/mutation-defaults.ts`:

a. Remove the legacy investments-fn imports (the entire `from '#/server/investments'` block at the top of the file):

```ts
// DELETE this entire import block:
import {
  addDepositFn,
  closeDpsFn,
  createDpsFn,
  createInvestmentFn,
  createSavingsFn,
  deleteInvestmentFn,
  deleteSavingsFn,
  markDepositPaidFn,
  removeDepositFn,
  updateDpsFn,
  updateInvestmentFn,
  updateSavingsFn,
  withdrawFn,
} from '#/server/investments'
```

(`trpcClient` is already imported from `#/lib/trpc` since Phase 2A — no new import needed.)

b. Swap each of the 13 `setMutationDefaults` entries. Pattern:

| Mutation key | New mutationFn body |
| ------------ | ------------------- |
| `investmentCreate` | `(input) => trpcClient.investments.create.mutate(input)` |
| `investmentUpdate` | `(input) => trpcClient.investments.update.mutate(input)` |
| `investmentDelete` | `(input) => trpcClient.investments.delete.mutate(input)` |
| `dpsCreate` | `(input) => trpcClient.investments.createDps.mutate(input)` |
| `dpsUpdate` | `(input) => trpcClient.investments.updateDps.mutate(input)` |
| `dpsClose` | `(input) => trpcClient.investments.closeDps.mutate(input)` |
| `markDepositPaid` | `(input) => trpcClient.investments.markDepositPaid.mutate(input)` |
| `savingsCreate` | `(input) => trpcClient.investments.createSavings.mutate(input)` |
| `savingsUpdate` | `(input) => trpcClient.investments.updateSavings.mutate(input)` |
| `savingsDelete` | `(input) => trpcClient.investments.deleteSavings.mutate(input)` |
| `addDeposit` | `(input) => trpcClient.investments.addDeposit.mutate(input)` |
| `removeDeposit` | `(input) => trpcClient.investments.removeDeposit.mutate(input)` |
| `withdraw` | `(input) => trpcClient.investments.withdraw.mutate(input)` |

For each, replace the `mutationFn` line. The input type annotation can remain (the tRPC client infers the correct input type, but keeping the explicit annotation makes the file readable and matches the emi entries done in Phase 2A).

Example before/after for one entry:

```ts
// BEFORE:
queryClient.setMutationDefaults(mutationKeys.investmentCreate, {
  ...offlineFirst,
  mutationFn: (input: InvestmentCreateInput) => createInvestmentFn({ data: input }),
})

// AFTER:
queryClient.setMutationDefaults(mutationKeys.investmentCreate, {
  ...offlineFirst,
  mutationFn: (input: InvestmentCreateInput) => trpcClient.investments.create.mutate(input),
})
```

### Step 3: Inspect and migrate `prefetch-profile-data.ts`

```bash
grep -n "investments\b\|listInvestments\|getInvestment" apps/web/src/lib/prefetch-profile-data.ts
```

For every reference to `listInvestmentsFn` or `getInvestmentFn`, replace with `trpcClient.investments.list.query(...)` or `trpcClient.investments.get.query(...)`. The file already imports `trpcClient` since Phase 2A.

If the file uses `investmentsListQueryOptions(filters)` (the old signature without a `queryClient` arg), update the call to pass `queryClient` per Task 3 Step 5.

### Step 4: Verify no stale investments-fn imports remain in apps/web/src/ (outside the soon-to-be-deleted wrappers)

```bash
grep -rn "from ['\"]#/server/investments['\"]" apps/web/src --include='*.ts' --include='*.tsx' | grep -v 'apps/web/src/server/investments'
```

Expected: zero matches. The legacy `investments.ts` and `investments.impl.ts` still exist (Task 5 deletes them).

### Step 5: Type-check + test

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -E "error TS" | head -20
pnpm test 2>&1 | tail -15
```

Expected: 5 pre-existing baseline errors persist; no new errors. 346 tests pass.

### Step 6: Commit

```bash
git status
git add apps/web/src/integrations/tanstack-query/mutation-defaults.ts apps/web/src/lib/prefetch-profile-data.ts
git commit -m "refactor(investments): switch mutation-defaults registry + prefetch to tRPC client"
git status
```

---

## Task 5: Delete `investments.ts` + `investments.impl.ts`, migrate `investments.test.ts`

37 tests across 1034 lines. Mechanical sweep with sed handles most of it; manual fixes for non-`await` references.

**Files:**
- Modify: `apps/web/tests/integration/investments.test.ts`
- Delete: `apps/web/src/server/investments.ts`
- Delete: `apps/web/src/server/investments.impl.ts`

### Step 1: Inspect the test file

```bash
head -20 apps/web/tests/integration/investments.test.ts
grep -n "Impl(" apps/web/tests/integration/investments.test.ts | head -30
```

You'll see calls like:
- `await createInvestmentImpl(user.profileId, { ... })`
- `await listInvestmentsImpl(user.profileId, { ... })`
- `await getInvestmentImpl(user.profileId, id)`
- `await updateInvestmentImpl(user.profileId, { ... })`
- `await deleteInvestmentImpl(user.profileId, { id })`
- `await createDpsInvestmentImpl(...)`, `updateDpsInvestmentImpl(...)`, `closeDpsImpl(...)`
- `await markDepositPaidImpl(...)`
- `await createSavingsInvestmentImpl(...)`, `updateSavingsInvestmentImpl(...)`
- `await addDepositImpl(...)`, `removeDepositImpl(...)`, `withdrawImpl(...)`

### Step 2: Update the test file imports

Replace the top of `apps/web/tests/integration/investments.test.ts`:

```ts
// BEFORE (delete):
import {
  addDepositImpl,
  closeDpsImpl,
  createDpsInvestmentImpl,
  createInvestmentImpl,
  createSavingsInvestmentImpl,
  deleteInvestmentImpl,
  getInvestmentImpl,
  listInvestmentsImpl,
  markDepositPaidImpl,
  removeDepositImpl,
  updateDpsInvestmentImpl,
  updateInvestmentImpl,
  updateSavingsInvestmentImpl,
  withdrawImpl,
} from '#/server/investments.impl'

// AFTER (add):
import { appRouter } from '@phinio/trpc'
import type { AppContext } from '@phinio/trpc'
import { prisma } from '#/db'

function callerFor(profileId: string) {
  const ctx: AppContext = { prisma, profileId, locale: 'en' }
  return appRouter.createCaller(ctx)
}
```

If `prisma` is already imported from `./helpers/db` (the test helper), reuse that — don't double-import.

### Step 3: Sweep-replace impl calls

Method calls map cleanly:

| Source pattern | Replacement |
| -------------- | ----------- |
| `await createInvestmentImpl(profileId, args)` | `await callerFor(profileId).investments.create(args)` |
| `await listInvestmentsImpl(profileId, args)` | `await callerFor(profileId).investments.list(args)` |
| `await getInvestmentImpl(profileId, id)` | `await callerFor(profileId).investments.get({ id })` (verify the schema's input key — adjust if it's `investmentId` instead) |
| `await updateInvestmentImpl(profileId, args)` | `await callerFor(profileId).investments.update(args)` |
| `await deleteInvestmentImpl(profileId, args)` | `await callerFor(profileId).investments.delete(args)` |
| `await createDpsInvestmentImpl(profileId, args)` | `await callerFor(profileId).investments.createDps(args)` |
| `await updateDpsInvestmentImpl(profileId, args)` | `await callerFor(profileId).investments.updateDps(args)` |
| `await closeDpsImpl(profileId, args)` | `await callerFor(profileId).investments.closeDps(args)` |
| `await markDepositPaidImpl(profileId, args)` | `await callerFor(profileId).investments.markDepositPaid(args)` |
| `await createSavingsInvestmentImpl(profileId, args)` | `await callerFor(profileId).investments.createSavings(args)` |
| `await updateSavingsInvestmentImpl(profileId, args)` | `await callerFor(profileId).investments.updateSavings(args)` |
| `await addDepositImpl(profileId, args)` | `await callerFor(profileId).investments.addDeposit(args)` |
| `await removeDepositImpl(profileId, args)` | `await callerFor(profileId).investments.removeDeposit(args)` |
| `await withdrawImpl(profileId, args)` | `await callerFor(profileId).investments.withdraw(args)` |

Use `sed` per the Phase 2A Task 12 pattern. For each `<X>Impl` name, generate two sed commands — one for `await X(profileId, ` patterns and one for `X(profileId, ` (no await, inside `expect(...).rejects` chains).

```bash
cd apps/web
sed -i '' 's|await createInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.create(|g' tests/integration/investments.test.ts
sed -i '' 's|await listInvestmentsImpl(\([^,]*\), |await callerFor(\1).investments.list(|g' tests/integration/investments.test.ts
sed -i '' 's|await getInvestmentImpl(\([^,]*\), \([^)]*\))|await callerFor(\1).investments.get({ id: \2 })|g' tests/integration/investments.test.ts
sed -i '' 's|await updateInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.update(|g' tests/integration/investments.test.ts
sed -i '' 's|await deleteInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.delete(|g' tests/integration/investments.test.ts
sed -i '' 's|await createDpsInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.createDps(|g' tests/integration/investments.test.ts
sed -i '' 's|await updateDpsInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.updateDps(|g' tests/integration/investments.test.ts
sed -i '' 's|await closeDpsImpl(\([^,]*\), |await callerFor(\1).investments.closeDps(|g' tests/integration/investments.test.ts
sed -i '' 's|await markDepositPaidImpl(\([^,]*\), |await callerFor(\1).investments.markDepositPaid(|g' tests/integration/investments.test.ts
sed -i '' 's|await createSavingsInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.createSavings(|g' tests/integration/investments.test.ts
sed -i '' 's|await updateSavingsInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.updateSavings(|g' tests/integration/investments.test.ts
sed -i '' 's|await addDepositImpl(\([^,]*\), |await callerFor(\1).investments.addDeposit(|g' tests/integration/investments.test.ts
sed -i '' 's|await removeDepositImpl(\([^,]*\), |await callerFor(\1).investments.removeDeposit(|g' tests/integration/investments.test.ts
sed -i '' 's|await withdrawImpl(\([^,]*\), |await callerFor(\1).investments.withdraw(|g' tests/integration/investments.test.ts
cd ../..
```

### Step 4: Find and fix non-`await` references

```bash
grep -n "Impl\b" apps/web/tests/integration/investments.test.ts | head -20
```

Any remaining `*Impl` reference (e.g., inside `expect(...).rejects.toThrow(...)`) needs the same swap by hand:
- `expect(markDepositPaidImpl(user.profileId, { ... })).rejects.toThrow(...)` → `expect(callerFor(user.profileId).investments.markDepositPaid({ ... })).rejects.toThrow(...)`

Apply by hand. Each appears once or twice per impl name in `.rejects` chains.

### Step 5: Adjust schema-input drift (if any)

The tRPC procedures validate input through their Zod schemas. The existing tests sometimes passed loosely-shaped data that the impl tolerated but a strict Zod parse would reject (e.g., a missing optional field or an extra unknown property — Zod may strip or reject depending on `.strict()`).

If a test fails with a Zod parse error after migration, look at the input data — adjust the test to match the schema rather than loosening the schema. The schema is the source of truth.

### Step 6: Type-check the test file before running

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep "tests/integration/investments" | head -20
```

Fix any errors. Common: `callerFor(...).investments.get({ id })` — if `investmentIdSchema` uses a different field name (e.g., `investmentId`), update the procedure input key everywhere.

### Step 7: Run the migrated tests

```bash
pnpm --filter @phinio/web test -- tests/integration/investments.test.ts 2>&1 | tail -30
```

Expected: all 37 tests pass via the tRPC caller.

### Step 8: Confirm no remaining consumers of the legacy files

```bash
grep -rn "from ['\"]#/server/investments['\"]\|from ['\"]#/server/investments\.impl['\"]" apps/web/src apps/web/tests --include='*.ts' --include='*.tsx' | grep -v 'apps/web/tests/integration/activity-log.test.ts'
```

Expected: zero matches (activity-log.test.ts still has them — Task 6 handles that).

### Step 9: Delete the legacy files

```bash
git rm apps/web/src/server/investments.ts apps/web/src/server/investments.impl.ts
```

### Step 10: Type-check + test again (after deletion)

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep -E "error TS" | head
pnpm test 2>&1 | tail -15
```

Expected: 5 pre-existing baseline errors persist. Note: at this point `activity-log.test.ts` will fail because it imports from the just-deleted file. That's fixed in Task 6 — DO NOT run the full test suite here, only type-check.

Actually, the type-check WILL flag `activity-log.test.ts` as broken. Don't try to fix it inside this task — Task 6 owns that fix. If the type-check noise from `activity-log.test.ts` is overwhelming, you can comment out its broken imports temporarily and add `// FIXME: Task 6 migrates these to caller`, then restore in Task 6. Or just commit the deletion despite the broken tests — the next task immediately repairs them.

**Pragmatic choice:** commit the deletion. The next task immediately repairs `activity-log.test.ts`.

### Step 11: Commit

```bash
git status
git add -A
git commit -m "refactor(investments): delete legacy wrappers + migrate investments.test.ts to tRPC caller"
git status
```

---

## Task 6: Migrate `activity-log.test.ts` to the tRPC caller

The activity-log integration tests use 4 investments impl functions to drive activity-log roundtrip assertions. With the impl files deleted in Task 5, this file's imports are broken — repair them.

**Files:**
- Modify: `apps/web/tests/integration/activity-log.test.ts`

### Step 1: Inspect

```bash
head -25 apps/web/tests/integration/activity-log.test.ts
grep -n "Impl(" apps/web/tests/integration/activity-log.test.ts | head -20
```

The imports include `createInvestmentImpl`, `createDpsInvestmentImpl`, `updateInvestmentImpl`, `markDepositPaidImpl` — all gone. The file also imports `listActivityImpl` (still legitimate, from `@phinio/trpc/activity-log`) and `logActivity` — those stay.

### Step 2: Update imports

Remove the import block for the 4 investments impls. Add the caller helper:

```ts
// REMOVE:
import {
  createDpsInvestmentImpl,
  createInvestmentImpl,
  markDepositPaidImpl,
  updateInvestmentImpl,
} from '#/server/investments.impl'

// ADD:
import { appRouter } from '@phinio/trpc'
import type { AppContext } from '@phinio/trpc'

function callerFor(profileId: string) {
  const ctx: AppContext = { prisma, profileId, locale: 'en' }
  return appRouter.createCaller(ctx)
}
```

(`prisma` is already imported via the test helper — verify by reading the existing imports. If not, add `import { prisma } from '#/db'`.)

### Step 3: Replace impl call sites

```bash
cd apps/web
sed -i '' 's|await createInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.create(|g' tests/integration/activity-log.test.ts
sed -i '' 's|await createDpsInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.createDps(|g' tests/integration/activity-log.test.ts
sed -i '' 's|await updateInvestmentImpl(\([^,]*\), |await callerFor(\1).investments.update(|g' tests/integration/activity-log.test.ts
sed -i '' 's|await markDepositPaidImpl(\([^,]*\), |await callerFor(\1).investments.markDepositPaid(|g' tests/integration/activity-log.test.ts
cd ../..
```

Find any non-`await` references and fix by hand:

```bash
grep -n "createInvestmentImpl\|createDpsInvestmentImpl\|updateInvestmentImpl\|markDepositPaidImpl" apps/web/tests/integration/activity-log.test.ts
```

### Step 4: Type-check + run the test

```bash
pnpm --filter @phinio/web exec tsc --noEmit 2>&1 | grep "tests/integration/activity-log" | head
pnpm --filter @phinio/web test -- tests/integration/activity-log.test.ts 2>&1 | tail -20
```

Expected: zero type errors in this file; all activity-log tests pass.

### Step 5: Run the full test suite

```bash
pnpm test 2>&1 | tail -20
```

Expected: 346 passing / 0 failing — same count as the Phase 2B baseline.

### Step 6: Commit

```bash
git status
git add apps/web/tests/integration/activity-log.test.ts
git commit -m "refactor(activity-log): migrate test consumers of investments impl to tRPC caller"
git status
```

---

## Task 7: Final regression gate + PR

**Files:** none modified.

### Step 1: Fresh-clone simulation

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules .turbo
pnpm install
ls packages/db/src/generated/ | head -3
```

Expected: postinstall runs `db:generate`; the generated dir exists.

### Step 2: Full pipeline

```bash
pnpm test 2>&1 | tee /tmp/phinio-phase2b-final-test.log | tail -25
pnpm lint 2>&1 | tee /tmp/phinio-phase2b-final-lint.log | tail -10
pnpm build:local 2>&1 | tee /tmp/phinio-phase2b-final-build.log | tail -15
```

All three must exit 0.

### Step 3: Diff against the Phase 2B baseline

```bash
echo "=== Phase 2B baseline ==="
grep -E "Tests" /tmp/phinio-phase2b-baseline-test.log | tail -3
echo "=== Phase 2B final ==="
grep -E "Tests" /tmp/phinio-phase2b-final-test.log | tail -3
```

Expected: identical 346/0 counts.

### Step 4: Manual end-to-end smoke test

```bash
pnpm --filter @phinio/web dev &
DEV_PID=$!
sleep 15
```

In a browser, log in. Run through these flows (each should round-trip via `/api/trpc/investments.*` — watch DevTools Network):
1. `/app/investments` — list renders for both lump-sum + DPS + savings tabs.
2. Create a lump-sum investment via `/app/investments/new`.
3. Create a DPS via `/app/investments/dps/new` (or wherever the form lives); confirm the optimistic schedule appears.
4. Mark a DPS deposit paid → checkbox flips instantly; backend confirms.
5. Add an ad-hoc deposit to a savings investment.
6. Withdraw from a lump-sum investment.
7. Close a DPS (early close).
8. Delete a savings investment.

If any step fails or the network tab shows a 500, capture the dev console output and report DONE_WITH_CONCERNS.

Kill the dev server:

```bash
kill $DEV_PID 2>/dev/null
```

### Step 5: Branch snapshot

```bash
echo "=== Branch ==="
git branch --show-current
echo
echo "=== Commits ahead of feat/phase-2a-trpc-emis ==="
git log --oneline feat/phase-2a-trpc-emis..HEAD
echo
echo "=== Commit count ==="
git rev-list --count feat/phase-2a-trpc-emis..HEAD
echo
echo "=== Diff size vs Phase 2A branch ==="
git diff --stat feat/phase-2a-trpc-emis..HEAD | tail -3
```

### Step 6: Open PR (stacked on Phase 2A)

Push and open the PR. Base = `main`, with a note about the stacking:

```bash
git push -u origin feat/phase-2b-trpc-investments
gh pr create --base main --title "Phase 2B: port investments domain to tRPC (15 procedures)" --body "$(cat <<'EOF'
## Summary

Ports the investments domain end-to-end onto `@phinio/trpc` using the template proven in Phase 2A. 15 procedures (lump-sum basics, DPS, savings, deposits, withdrawals) live in `packages/trpc/src/routers/investments.ts`. Web hooks, mutation registry, prefetch helpers, and 41 integration tests all migrate. Legacy `investments.ts` + `investments.impl.ts` (~1215 lines) deleted.

> ⚠️ **Stacks on #24 (Phase 2A).** Merge Phase 2A first, or review both together. Until 2A lands on main, the diff on this PR includes 2A's changes.

Implements Phase 2B of the React Native rollout (`docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §3).

## What's in this PR

- **`packages/trpc/src/routers/investments.ts`** — 15 procedures (line-for-line port of impl bodies with mechanical substitutions: `profileId → ctx.profileId`, `prisma → ctx.prisma`, `data → input`)
- **`packages/trpc/src/router.ts`** — `appRouter` now mounts `investments` alongside `emis`
- **`apps/web/src/hooks/useInvestments.ts`** — 3 query hooks migrated to `trpc.investments.*.queryOptions(...)`
- **`apps/web/src/integrations/tanstack-query/mutation-defaults.ts`** — 13 investments entries switched from `*Fn({ data })` to `trpcClient.investments.*.mutate(...)`
- **`apps/web/src/lib/prefetch-profile-data.ts`** — investments prefetch on tRPC
- **`apps/web/tests/integration/investments.test.ts`** — 37 tests migrated to `appRouter.createCaller(ctx)`
- **`apps/web/tests/integration/activity-log.test.ts`** — 4 impl call sites swapped to caller
- **DELETED**: `apps/web/src/server/investments.ts` (174 lines) and `apps/web/src/server/investments.impl.ts` (1041 lines)

## Invariants preserved (same as Phase 2A)

- Client-minted UUIDs for entity `id` and `clientMutationId` — unchanged
- `mutationKey` values — unchanged → offline-replay registry continues to work
- Activity-log writes still happen inside the same transaction as primary writes
- Optimistic update logic in `useInvestments.ts` — unchanged

## Test plan

- [x] `pnpm test` — 346 passing / 0 failing (340 web + 2 trpc + 2 calc + 2 design-tokens)
- [x] `pnpm lint` — clean
- [x] `pnpm build:local` — success
- [x] tRPC routes return UNAUTHORIZED envelope when unauthenticated (not 500)
- [ ] Manual: investment golden paths (lump-sum / DPS / savings create-edit-delete-deposit-withdraw-close) verify before merge

## Out of scope (next plans)

- Phase 2C — `activity` domain
- Phase 2D — `notifications` domain
- Phase 2E — `profile` domain
- Phase 2F — `push` domain
- Locale resolution in `trpc-context.ts` (currently `'en'` hard-coded)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage** (against §3 of `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md`):

- ✅ `packages/trpc/src/routers/investments.ts` — 15 procedures — Task 2.
- ✅ `appRouter` includes `investments` — Task 2 Step 4.
- ✅ Web hooks migrated — Task 3.
- ✅ Mutation registry migrated — Task 4.
- ✅ Prefetch migrated — Task 4.
- ✅ Tests migrated — Tasks 5 + 6.
- ✅ Legacy files deleted — Task 5.
- ⏭️ Other domains (activity, notifications, profile, push) — explicitly out of scope.

**Placeholder scan:** No "TBD" / "implement later" / "fill in details". The two intentional `// PASTE …` references in Task 2 are deliberate — they mark byte-for-byte copies from a named source file. The plan reader/implementer can find the source impl bodies in `apps/web/src/server/investments.impl.ts` at the line numbers identified in Task 2 Step 1.

**Type / name consistency:**
- Procedure names match the wrapper exports in `apps/web/src/server/investments.ts` (minus the `Fn` suffix): `list`, `get`, `create`, `update`, `delete`, `createDps`, `updateDps`, `closeDps`, `markDepositPaid`, `createSavings`, `updateSavings`, `deleteSavings`, `addDeposit`, `removeDeposit`, `withdraw` — used identically in Tasks 2, 3, 4, 5.
- Mutation keys (`mutationKeys.investmentCreate`, etc.) — unchanged from Phase 2A baseline.
- `callerFor(profileId)` helper has the same signature in Tasks 5 + 6 — `ctx: AppContext = { prisma, profileId, locale: 'en' }`.

**Risks the plan does not eliminate:**
- The schema input-key drift (Task 5 Step 5): `investmentIdSchema` may use a key name other than `id`. The plan flags this explicitly and tells the implementer to verify against `@phinio/validators` and adjust call sites uniformly.
- `deleteSavings` and `delete` share an impl body. The plan keeps two distinct procedures with duplicate inline bodies for migration faithfulness. A follow-up cleanup could factor the body into a local helper, but that's deliberately out of scope.
- The 37-test migration leans on sed patterns. Any test that doesn't match the pattern (e.g., a destructuring assignment from an impl call) will need manual fixing — Task 5 Step 4 names this.
