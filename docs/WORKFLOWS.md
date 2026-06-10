# Workflows

Execution patterns for Phinio. Each section is a recipe — when you're adding a feature, find the matching workflow and follow it. For the _why_ behind these patterns, see `docs/ARCHITECTURE.md`.

---

## 1. Server function (read)

```
Component
  └─ useQuery in src/hooks/use*.ts
      └─ calls listFooFn from src/server/foo.ts
          └─ wrapper: createServerFn().inputValidator(zod).handler(async ({data}) => {
              const { requireProfileId, listFooImpl } = await import('./foo.impl')
              return listFooImpl(await requireProfileId(), data)
            })
              └─ impl: requireProfileId() pulls Better Auth session → Profile.id
                  └─ prisma.foo.findMany({ where: { profileId, ...filters } })
```

**Rules:**

- The wrapper file (`*.ts`) **never statically imports** `*.impl.ts`, Prisma, or Better Auth. Always `await import('./foo.impl')` inside the handler.
- Every Prisma query includes `profileId` in `where`. No exceptions.
- Validators live in `@phinio/validators` and are imported by both wrapper and impl.

---

## 2. Server function (mutation) — the canonical pattern

Every mutation follows this template (verbatim from `src/server/emis.impl.ts`):

```ts
export async function createFooImpl(profileId: string, input: FooCreateInput) {
  return withIdempotency(profileId, input.clientMutationId, async (tx) => {
    // 1. Primary write — use the tx, not prisma directly.
    const row = await tx.foo.create({
      data: {
        id: input.id ?? undefined, // accept client-minted UUID for offline
        profileId,
        ...rest,
      },
    });

    // 2. Activity log — same transaction, after the primary write.
    await logActivity(tx, profileId, {
      action: "create",
      entityType: "foo",
      entityId: row.id,
      entityLabel: row.name, // denormalized — survives deletion
      summary: fmtText(`Added ${row.name}`),
    });

    return row;
  });
}
```

`withIdempotency` lives in `src/server/_idempotency.ts`. It:

1. Opens a `prisma.$transaction`.
2. If `clientMutationId` is set, looks up `ProcessedMutation` — replays cached `resultJson` on hit.
3. Runs the mutation function.
4. Records the result in `ProcessedMutation` so future replays return the same value.

**For updates:** also pass `expectedUpdatedAt` (the `updatedAt` the client last saw) for last-write-wins reconciliation. If mismatched, the server's row wins and the client toasts "your edit was overwritten."

---

## 3. Client mutation hook (offline-safe)

Every `use*` mutation in `src/hooks/` follows this shape (model after `useMarkPayment` in `src/hooks/useEmis.ts`):

```ts
export function useCreateFoo() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: fooKeys.create,
    mutationFn: (input) =>
      createFooFn({
        data: {
          ...input,
          id: input.id ?? crypto.randomUUID(), // client-minted UUID
          clientMutationId: crypto.randomUUID(), // idempotency key
        },
      }),
    networkMode: "offlineFirst", // queue while offline

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: fooKeys.list() });
      const previous = qc.getQueryData(fooKeys.list());
      qc.setQueryData(fooKeys.list(), (old) => [
        optimisticRow(input),
        ...(old ?? []),
      ]);
      return { previous };
    },

    onError: (_err, _input, ctx) => {
      qc.setQueryData(fooKeys.list(), ctx?.previous);
      toast.error("Failed to save — try again");
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fooKeys.list() });
    },
  });
}
```

**Rules:**

- Always mint `clientMutationId` (and `id` for creates) on the client. Never let the server generate IDs for offline-eligible mutations.
- `onMutate` writes to the cache _before_ the network call — UI updates instantly.
- `onError` rolls back from the snapshot in `ctx`.
- `mutationKey` must be **registered** in `src/integrations/tanstack-query/mutation-defaults.ts` (via `registerMutationDefaults`, invoked from `root-provider.tsx`) so paused mutations rehydrate with a `mutationFn` and survive page reload. The typed wrapper `useOfflineMutation` in `src/lib/use-offline-mutation.ts` enforces the `clientMutationId` shape but is not the registry.

---

## 4. Mutation lifecycle (online vs. offline)

| Phase            | Online                        | Offline                                                           |
| ---------------- | ----------------------------- | ----------------------------------------------------------------- |
| User taps button | `onMutate` patches cache      | `onMutate` patches cache                                          |
| `mutationFn`     | Fires immediately             | Paused (`networkMode: 'offlineFirst'`)                            |
| Network          | Server runs `withIdempotency` | Mutation persisted to IndexedDB                                   |
| Reconnect        | n/a                           | `online` event → `resumePausedMutations()`                        |
| Replay           | n/a                           | Server sees same `clientMutationId` → no-op or first-time-execute |
| Result           | `onSuccess` invalidates       | `onSuccess` invalidates after replay                              |

The `online` event handler lives in `src/routes/__root.tsx`'s `RootDocument` effect. It awaits `persisterReady`, verifies the Better Auth session, wipes the cache on a cross-account mismatch (cached vs. current `user.id`), then calls `resumePausedMutations()` + `invalidateQueries()` + `prefetchProfileData()`. The session check runs first because a 401 on replay would otherwise be silent.

---

## 5. EMI creation (special case)

EMIs require their full `EmiPayment` schedule generated up-front. The flow:

1. **Client** (`useCreateEmi` in `src/hooks/useEmis.ts`):
   - Mints UUID for the EMI.
   - Calls `generateAmortization()` from `src/lib/emi-calculator.ts` (pure, isomorphic).
   - Mints UUID per `EmiPayment` row.
   - Optimistically writes EMI + payments to cache so detail view renders immediately.
2. **Wire format:** sends `{ id, ...emiFields, paymentIds: [...] }` (or full payments array — see `OFFLINE_PLAN.md` Phase 4).
3. **Server** (`createEmiImpl`):
   - Wraps in `withIdempotency`.
   - If `id` provided, uses it; otherwise generates server-side (legacy online path).
   - Same for payment IDs — must round-trip to keep cache and server consistent.

`EmiPayment.paymentNumber === FEE_PAYMENT_NUMBER` denotes a synthetic fee row. Always go through `isFeePayment` / `isRegularPayment` helpers — never compare the magic number directly.

---

## 6. Activity log

Write one `ActivityLog` row per user-initiated mutation, **inside the same transaction** as the primary write. Use helpers in `src/server/activity-log.impl.ts`:

- `logActivity(tx, profileId, entry)` — single row insert.
- `diffFields(oldRow, newRow, fields)` — produces the `changes` array for updates.
- `fmtText(...)` — composes the human-readable `summary`.

**Always denormalize `entityLabel`** — copy the entity's name at write time. The log must still read correctly after the entity is deleted.

Activity log writes are **server-only**. Don't optimistically prepend client-side; the activity feed is a "look back" surface and the parent entity's optimistic update already provides immediate feedback (see `OFFLINE_PLAN.md` Decision 5).

---

## 7. Push notifications / reminders

1. **Subscribe:** client calls `usePushSubscription` → `subscribePushFn` writes a `PushSubscription` row.
2. **Dispatch:** `src/routes/api/cron/` routes run on Vercel cron. They:
   - Query `EmiPayment` and `InvestmentDeposit` rows where `dueDate` is within reminder window.
   - For each, look up `PushSubscription` by `profileId`.
   - Fire via `web-push` with VAPID keys.
   - Insert a `Notification` row with a `dedupeKey` (e.g. `emi_payment:{id}:upcoming`) — the unique constraint prevents double-sending.
3. **Display:** `useNotifications` queries the feed for the bell icon.

Push payload text is rendered through a per-locale i18n + currency/date formatter (cached by `Locale` in `send-reminders.ts`) keyed off `Profile.preferredLanguage`.

Required env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto/URL identifying the sender), and `CRON_SECRET` (Bearer token validated via `timingSafeEqual` in the cron handler). All read from `.env.local`.

---

## 8. Adding a new screen

1. **Reference order:** PRD section (behavior) → `screens/<name>/code.html` (layout) → `docs/design.md` + `screens/phinio_modern_noir/DESIGN.md` (tokens).
2. Create route file under `src/routes/app/<area>/<name>.tsx`. Plugin regenerates `routeTree.gen.ts` automatically — never hand-edit it.
3. Compose components from `src/components/`. New leaf components go there; per-screen layouts stay in the route file.
4. Data: add a hook in `src/hooks/` if the screen has its own queries; otherwise import an existing one.
5. Cross-check `BottomTabBar.tsx` if the screen needs a tab entry.

---

## 9. Database changes

```bash
# 1. Edit packages/db/prisma/schema.prisma
pnpm db:generate    # regenerates client into packages/db/src/generated/
pnpm db:migrate     # creates a migration in packages/db/prisma/migrations + applies it
# OR for rapid dev iteration:
pnpm db:push        # push schema without a migration
```

All `db:*` scripts under `packages/db` are wrapped in `dotenv -e ../../.env.local`. Don't run `npx prisma` directly — it won't pick up `DATABASE_URL`.

When adding offline-eligible models, also add `updatedAt @updatedAt` for LWW reconciliation.

---

## 10. Pre-commit checklist

```bash
pnpm check          # prettier --write + eslint --fix
pnpm test           # vitest across the workspace via turbo
pnpm build:local    # full build with .env.local — catches type errors
```

`pnpm build` (without `:local`) chains in `prisma migrate deploy` which needs a reachable DB — always use `build:local` for a local sanity check.
