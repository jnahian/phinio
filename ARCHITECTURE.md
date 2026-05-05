# Architecture

High-level system design for Phinio. For deeper specs, see:

- **Product behavior:** `docs/Phinio_PRD_v1.md`
- **Database:** `SCHEMAS.md` (and `prisma/schema.prisma`)
- **Execution patterns:** `WORKFLOWS.md`
- **Offline strategy:** `docs/OFFLINE_PLAN.md`

---

## 1. System overview

Phinio is a single-user, mobile-first PWA. One user → one `Profile` → many `Investment`/`Emi` records. There is no multi-tenant or sharing layer. The architecture optimizes for: (a) installable PWA on iOS/Android, (b) offline-first reads and writes, (c) a single Postgres source of truth.

```
┌─────────────────────────────────────────────────────────┐
│  Browser (PWA)                                          │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ React 19   │ → │ TanStack     │ → │ Service      │  │
│  │ Components │   │ Query cache  │   │ Worker (sw)  │  │
│  └────────────┘   │ + IDB persist│   │ + Web Push   │  │
│        ↓           └──────────────┘   └──────────────┘  │
│   Hooks (use*) — call createServerFn() RPCs             │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTPS (TanStack Start RPC over POST)
┌─────────────────┴───────────────────────────────────────┐
│  TanStack Start (Vercel / Nitro)                        │
│  ┌────────────┐   ┌────────────────┐   ┌─────────────┐ │
│  │ File-based │   │ Server fns     │   │ Better Auth │ │
│  │ routes     │ → │ *.ts wrapper   │ → │ session +   │ │
│  │ (SSR + RPC)│   │ *.impl.ts impl │   │ profileId   │ │
│  └────────────┘   └────────────────┘   └─────────────┘ │
│                          ↓                              │
│                    Prisma (pg adapter)                  │
└─────────────────────────┬───────────────────────────────┘
                          │
                  ┌───────┴────────┐
                  │ Postgres (Neon)│
                  └────────────────┘
```

---

## 2. Layers

### Frontend — `src/components`, `src/routes`, `src/hooks`

- **TanStack Router** with file-based routing. Route tree is **code-generated** to `src/routeTree.gen.ts` — never hand-edit it; add files under `src/routes/` and the plugin regenerates.
- `src/routes/__root.tsx` is the shell (html/head/body, theme init, devtools, offline banner).
- `src/routes/app/route.tsx` is the authenticated zone — its `beforeLoad` runs the session guard.
- **Hooks layer** (`src/hooks/use*.ts`) wraps server-fn calls in TanStack Query (`useQuery` / `useMutation`) with optimistic `onMutate` + `onError` rollback. This is the only layer components should touch.

### Server — `src/server/*.ts` + `src/server/*.impl.ts`

Two-file split per domain (e.g. `emis.ts` + `emis.impl.ts`):

- `*.ts` — public wrapper. Contains `createServerFn(...)` declarations. **Must not statically import** Prisma, Better Auth, or anything Node-only — those would leak into the client bundle. Implementation modules are pulled in via dynamic `await import('./*.impl')` inside the handler.
- `*.impl.ts` — implementation. Imports Prisma, derives `profileId` from the Better Auth session, runs queries scoped by `profileId`.

This split is mandatory — a static import of `./*.impl` from `*.ts` will pollute the client bundle and break the build.

### Auth — `src/lib/auth.ts` + `src/routes/api/auth/$.ts`

- Better Auth 1.5 with email/password, email verification, password reset.
- `tanstackStartCookies()` plugin issues an httpOnly session cookie.
- The single catch-all route `src/routes/api/auth/$.ts` forwards GET/POST to `auth.handler(request)` — every Better Auth endpoint runs through that one file.
- Client-side hooks in `src/lib/auth-client.ts`.
- **Authorization is per-query, not per-route.** Every `*.impl.ts` mutation / query derives `profileId` from the session and includes it in the Prisma `where` clause.

### Database — Prisma 7 + pg adapter

- Custom output: `src/generated/prisma/`. `src/db.ts` imports `PrismaClient` from `./generated/prisma/client.js` — **not** `@prisma/client`.
- Connection: `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations) via Neon.
- Memoized on `globalThis.__prisma` in dev to survive HMR.
- After editing `schema.prisma`, run `npm run db:generate` before types resolve.
- All `db:*` npm scripts are wrapped in `dotenv -e .env.local` — invoke them via npm, never `npx prisma` directly.

### PWA — `src/sw.ts` + `vite-plugin-pwa`

- Service Worker handles shell caching + navigation fallback for `/app/*` (cold offline load).
- IndexedDB persistence for the TanStack Query cache (Phase 1 of `OFFLINE_PLAN.md`).
- Web Push via `web-push` + VAPID for EMI / DPS payment reminders.

---

## 3. Cross-cutting concerns

### Offline-first

Cache lives in IndexedDB (24h `gcTime`, 7-day persister `maxAge`). Mutations queue while offline (`networkMode: 'offlineFirst'`) and replay on reconnect via `queryClient.resumePausedMutations()`. Idempotency is enforced server-side via `clientMutationId` + `ProcessedMutation` table — see `WORKFLOWS.md`.

Cached financial data must survive app patch releases — the persister buster is a manually-bumped `CACHE_SCHEMA_VERSION`, **not** the app version.

### Money handling

All monetary fields are `Decimal(15,2)` in Prisma. **Never coerce to JS `number` for arithmetic.** Wire format is strings; server aggregations use `Prisma.Decimal`; client-side optimistic totals come from pure helpers in `src/lib/emi-calculator.ts` / `src/lib/dps-calculator.ts` which return strings.

### EMI amortization

When an EMI is created, the server function generates **all** `EmiPayment` rows up-front using formulas in PRD §9.2 (`src/lib/emi-calculator.ts`). Schedules are not computed on read.

For offline `createEmi`: the client mints UUIDs for the EMI and every payment row, calls `generateAmortization()` locally, and the server accepts those IDs to keep optimistic cache and server response in sync (see `OFFLINE_PLAN.md` Phase 4).

### Activity log

Every user-initiated mutation writes one `ActivityLog` row. `entityLabel` is **denormalized at write time** so the log still reads correctly after the entity is deleted. Server-only — not optimistically prepended on the client (see `OFFLINE_PLAN.md` Decision 5).

### Styling

Tailwind v4 via `@tailwindcss/vite`. **No `tailwind.config.js`** — all tokens live under `@theme` in `src/styles.css`. Dark-only; see `design.md`.

---

## 4. Path aliases

`#/*` and `@/*` both map to `src/*`. Existing code uses `#/lib/auth` style — follow that.

---

## 5. Deployment

- **Vercel** with Nitro preset. Build-time prerender for public marketing pages; SSR for `/app/*`.
- **Cron** under `src/routes/api/cron/` for daily reminder dispatch and `ProcessedMutation` cleanup (>30d).
- **Env gotcha:** `BETTER_AUTH_URL` is embedded verbatim into every email link. Dev `:3000` works; `npm run preview` on `:4173` requires temporarily setting `BETTER_AUTH_URL=http://localhost:4173`.

---

## 6. Implementation phases

PRD §10 defines the order: **Foundation → App Shell → Investments → EMI Manager → Dashboard.** Follow that unless explicitly redirected.
