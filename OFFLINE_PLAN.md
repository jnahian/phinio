# Offline-first plan

Goal: **offline reads + offline writes + instant UI** for Phinio, layered on the existing TanStack Start + TanStack Query + Prisma stack without a full sync engine (no RxDB / Replicache / PowerSync).

Source of truth stays Postgres. Client gets a persisted cache and a persisted mutation queue; conflicts resolve as last-write-wins by `updatedAt` on the server.

---

## Codebase facts this plan rests on

These were verified against the current branch — the plan changes if any of them turn out wrong.

| Fact                                                                                          | Where                                                    | Implication                                                                      |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Every domain model is `@id @default(uuid())`                                                  | `prisma/schema.prisma`                                   | Client can mint UUIDs and send them as `id`. **No temp-ID reconciliation step.** |
| `src/lib/emi-calculator.ts` is pure (no Prisma, no Node-only APIs)                            | `src/lib/emi-calculator.ts:1-183`                        | Client can call `generateAmortization()` directly for offline EMI creation.      |
| Server functions use `.ts` (wrapper) + `.impl.ts` (implementation) split with dynamic imports | e.g. `src/server/emis.ts:1-58`                           | Idempotency lives in `.impl.ts`, validator changes in `src/lib/validators.ts`.   |
| `useMarkPayment` already implements `onMutate` rollback                                       | `src/hooks/useEmis.ts:92-134`                            | Existing pattern to copy for the rest.                                           |
| `QueryClient` is constructed in one place                                                     | `src/integrations/tanstack-query/root-provider.tsx:3-16` | Single insertion point for the persister.                                        |
| Service worker already exists                                                                 | `src/sw.ts`                                              | Reuse for shell caching; don't bolt on a second SW.                              |

---

## Schema gaps

Need to add **before** Phase 2 ships:

```prisma
// Add updatedAt @updatedAt to:
model Emi { ...; updatedAt DateTime @updatedAt }
model EmiPayment { ...; updatedAt DateTime @updatedAt }
model InvestmentDeposit { ...; updatedAt DateTime @updatedAt }
model InvestmentWithdrawal { ...; updatedAt DateTime @updatedAt }
model Profile { ...; updatedAt DateTime @updatedAt }
// Investment already has it.

// New idempotency table:
model ProcessedMutation {
  id               String   @id @default(uuid())
  profileId        String
  profile          Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  clientMutationId String
  resultJson       Json?    // cached response so retries return the same value
  createdAt        DateTime @default(now())

  @@unique([profileId, clientMutationId])
  @@index([createdAt]) // for TTL cleanup
  @@map("processed_mutations")
}
```

Migration strategy: `npm run db:migrate` with a single migration that backfills `updatedAt = createdAt` for existing rows. `ProcessedMutation` is an empty new table, no backfill.

---

## Phases

### Phase 1 — Persisted reads

Goal: app loads from IndexedDB cache when offline, no UI changes, no mutation changes.

**Changes:**

- Add deps: `@tanstack/query-persist-client-core`, `idb-keyval`.
- In `src/integrations/tanstack-query/root-provider.tsx`:
  - Bump `gcTime` from `10 * 60_000` to `24 * 60 * 60_000` (24h) so cache entries don't get garbage-collected before the persister can write them.
  - Build an IndexedDB persister using `idb-keyval` (one key per Phinio-version namespace, e.g. `phinio-cache-v1`).
  - Wrap the client with `persistQueryClient({ queryClient, persister, maxAge: 7 * 24 * 60 * 60_000, buster: appVersion })`.
  - **Wrap the persister setup in try/catch** — if IndexedDB rejects (Safari Private Browsing, quota), fall back to in-memory cache and emit a one-time toast "Offline mode unavailable on this device".
- Custom `serialize`/`deserialize` for the persister. Verify how `Decimal(15,2)` round-trips through `createServerFn` — Prisma's pg adapter typically returns `Decimal` as a string, but if it comes through as `Prisma.Decimal { s, e, d }`, the persister must preserve that shape.
- **Service worker (`src/sw.ts`):** add a precached SPA shell + navigation fallback for `/app/*` so a cold offline load mounts the React app, which then reads from IndexedDB.
- **Better Auth offline check** (`src/lib/auth-client.ts`): verify the auth client doesn't hard-fail when the session-check request errors out. If it does, gate the failing path on `navigator.onLine` so offline cold-load isn't kicked to `/login`.

**Manual verification:**

1. Load the app online, navigate to `/app/investments` and `/app/emis`.
2. DevTools → Application → Service Workers → "Offline".
3. Hard reload — investments and EMIs should still render from cache.
4. DevTools → Application → IndexedDB → confirm `phinio-cache-v1` has data.
5. **Cold-load offline:** close the tab, go offline, open the app fresh — should boot to the cached state, not the browser's "no internet" page.

**Out of scope:** mutations (still fail offline), conflict UX.

---

### Phase 2 — Server idempotency + LWW

Goal: server tolerates duplicate replays of the same mutation and resolves conflicting writes deterministically. Still no client-side offline writes — this is server prep.

**Schema:** apply the migration above (`updatedAt` columns + `ProcessedMutation` table).

**Validator changes** (`src/lib/validators.ts`): every mutation schema gets an optional `clientMutationId: z.string().uuid().optional()`. Optional so the existing online flow keeps working unchanged.

**Server impl pattern** (apply to every `*Impl` mutation in `src/server/*.impl.ts`):

```ts
async function withIdempotency<T>(
  profileId: string,
  clientMutationId: string | undefined,
  expectedUpdatedAt: Date | undefined, // for updates only
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (clientMutationId) {
      const existing = await tx.processedMutation.findUnique({
        where: { profileId_clientMutationId: { profileId, clientMutationId } },
      })
      if (existing) return existing.resultJson as T
    }
    const result = await fn(tx)
    if (clientMutationId) {
      await tx.processedMutation.create({
        data: {
          profileId,
          clientMutationId,
          resultJson: result as Prisma.InputJsonValue,
        },
      })
    }
    return result
  })
}
```

**LWW for updates:** updater passes `expectedUpdatedAt` (the `updatedAt` the client last saw). Server compares; if mismatched, server's row wins and is returned to the client. Client toasts "your edit was overwritten" and reconciles. Creates and deletes don't need this.

**Cleanup job:** add a daily cron (or scheduled task) to delete `ProcessedMutation` rows older than 30d. Out of scope for the phase but flag in TASKS.md.

**Manual verification:** unit-test `withIdempotency` (replay returns cached result); integration-test concurrent updates (second update sees server-wins).

---

### Phase 3 — Offline writes + queue

Goal: tapping "Add Investment" / "Mark Paid" / etc. while offline queues the mutation, updates the UI optimistically, and replays on reconnect.

**Persister upgrade:** `persistQueryClient` already covers mutations if you opt in:

```ts
queryClient.setMutationDefaults(['investments', 'create'], {
  mutationFn: (input) => createInvestmentFn({ data: input }),
  networkMode: 'offlineFirst',
})
// And register every other mutation key the same way.
```

Mutations registered with `setMutationDefaults` survive page reloads via `persistQueryClient` and can be resumed with `queryClient.resumePausedMutations()`.

**Per-mutation work** in `src/hooks/use*.ts`:

1. Add `clientMutationId: crypto.randomUUID()` and (for creates) `id: crypto.randomUUID()` to the mutation input.
2. Add `onMutate` (model after `useMarkPayment`):
   - Cancel related queries.
   - Snapshot previous data.
   - Apply optimistic patch (insert with the client UUID, update fields, soft-delete).
   - Return rollback context.
3. `onError`: roll back from snapshot, toast.
4. `onSuccess`: invalidate (already done in most hooks).

Mutations to update:

- `useCreateInvestment`, `useUpdateInvestment`, `useDeleteInvestment`
- `useCreateDeposit`, `useUpdateDeposit`, `useMarkDepositPaid`
- `useCreateWithdrawal`, `useDeleteWithdrawal`
- `useCreateEmi` (Phase 4 finishes this), `useDeleteEmi`
- `useMarkPayment` (already optimistic; just add `clientMutationId`)
- `useUpdateProfile`, etc.

**Reconnect handler** (one-time wiring, e.g. inside `__root.tsx` or a small hook):

```ts
useEffect(() => {
  const onOnline = async () => {
    // Verify session before flushing — 401s are silent failures.
    const ok = await checkSession()
    if (!ok) return showSignInPrompt()
    queryClient
      .resumePausedMutations()
      .then(() => queryClient.invalidateQueries())
  }
  window.addEventListener('online', onOnline)
  return () => window.removeEventListener('online', onOnline)
}, [])
```

**`networkMode: 'offlineFirst'`** on mutations: TanStack Query won't fire the `mutationFn` while offline; it stays in `paused` state, the `onMutate` optimistic update is already in the cache, and it executes when `resumePausedMutations` is called.

**Out of scope:** Background Sync API (the Service Worker `sync` event). It would let mutations replay even after the tab closes, but adds significant complexity. Defer until Phase 5 (UX) is done and we know whether tab-close-replay is actually wanted.

---

### Phase 4 — EMI offline creation

Goal: offline `createEmi` produces a fully populated detail view (header + 12-60 `EmiPayment` rows) immediately.

**Almost free** because `src/lib/emi-calculator.ts` is already isomorphic.

**Hook change** (`src/hooks/useEmis.ts:56`, `useCreateEmi`):

- In `onMutate`, generate the EMI's UUID and call `generateAmortization()` to produce the rows.
- Mint a UUID per `EmiPayment` row.
- Insert the EMI into `emiKeys.list(...)` cache and the detail into `emiKeys.detail(emiId)` cache, including the full `payments` array.

**Server change** (`src/server/emis.impl.ts`, `createEmiImpl`):

- Accept optional `id` and per-payment `id`s in the input. If omitted (legacy online flow), keep generating server-side.
- Wrap in `withIdempotency`.

**Validator change** (`src/lib/validators.ts`, `emiCreateSchema`):

- Add optional `id: z.string().uuid().optional()` and `paymentIds: z.array(z.string().uuid()).optional()` (or accept the full payments array — TBD on which is cleaner).

**Why the IDs need to round-trip:** if the server generates new UUIDs for payments, the client cache (built optimistically with its own UUIDs) and server response disagree on row identity. The next "Mark Paid" tap before the cache invalidates would target a stale UUID. Forcing the server to use client-supplied UUIDs avoids this. Alternative: rely on the post-success invalidation to fully replace the cache — works but causes a visible flicker in the schedule on slow networks.

---

### Phase 5 — UX

Goal: user can see when something is queued, when sync is happening, and when a write was overwritten.

**Components to add:**

1. **Online/offline banner** — top of `__root.tsx`, fixed-position, dismissible. Hooks into `navigator.onLine` + `online`/`offline` events.
2. **Sync badge** on rows that have a pending mutation. Read `queryClient.getMutationCache().getAll()` and match by mutation key + variables. Tiny dot or "syncing" pill.
3. **Reconciliation toast** — when an update returns a server-wins payload, toast "your last edit was replaced by a newer change" with an "undo" affordance (optional, expensive).
4. **Failed mutation tray** — for mutations that 4xx'd on replay (validation drift, deleted parent row). Let the user inspect/retry/discard.

---

## Decisions

| #   | Decision                                                                                                                           | Rationale                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Storage quota:** silent degrade with one-time toast. Wrap persister setup in try/catch; on failure fall back to in-memory cache. | Personal-finance volumes fit in <1MB; only failure modes (Safari Private Browsing, disk full) aren't user-fixable from inside the app.                                                                                                                                                                                                                                 |
| 2   | **Decimal arithmetic:** strings on the wire, native JS `Number` for math, round to 2dp at every boundary. No `decimal.js`.         | JS `Number` is safe to ~9 quadrillion — well within personal-finance bounds. The existing `src/lib/emi-calculator.ts:51-53` pattern is the standard. Revisit only on a concrete drift bug.                                                                                                                                                                             |
| 3   | **Background Sync API:** skip.                                                                                                     | Phinio is an active-use app; tab-open replay covers ~99% of cases and iOS Safari doesn't support Background Sync anyway.                                                                                                                                                                                                                                               |
| 4   | **Cold offline load:** Service Worker precaches a static SPA shell + navigation fallback for `/app/*`.                             | Standard PWA pattern. Folded into Phase 1 scope. Acceptance criterion includes verifying Better Auth's client tolerates an offline session-check.                                                                                                                                                                                                                      |
| 5   | **Offline activity log writes:** server-only.                                                                                      | The activity feed is a "look back" feature; the optimistic entity update already provides immediate feedback. Doubling the queue size and reconciling server-rendered `entityLabel` / `summary` strings isn't worth it. If "instant activity feed" matters later, optimistically prepend a placeholder row in the activity query while the parent mutation is pending. |

---

## What this plan deliberately does not do

- **Multi-device CRDT sync.** Single-user app with low edit frequency; LWW is enough.
- **Real-time push.** No WebSockets, no SSE — reconnect handler is poll-on-online.
- **Schema duplication on the client.** No second source of truth (Dexie schemas, RxDB collections). The TanStack Query cache _is_ the client store.
- **Encrypted-at-rest IndexedDB.** Phinio data is per-user financial data already behind login; browser-level isolation is the security model. Revisit if shared-device usage becomes a thing.
- **Background Sync API for tab-close replay.** See Decision 3 — replay happens on next tab open instead.

---

## Rough sequencing

| Phase                 | Est. effort | Depends on       |
| --------------------- | ----------- | ---------------- |
| 1 — Persisted reads   | 0.5–1 day   | nothing          |
| 2 — Idempotency + LWW | 1–2 days    | schema migration |
| 3 — Offline writes    | 2–3 days    | Phase 2          |
| 4 — EMI offline       | 0.5 day     | Phase 3          |
| 5 — UX                | 1–2 days    | Phase 3          |

Each phase is independently shippable. After Phase 1 the app is meaningfully faster (no waterfall on cached reads) even with no offline writes.
