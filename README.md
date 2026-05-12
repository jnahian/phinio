# Phinio

**Your private financial vault.** A mobile-first Progressive Web App for personal finance — investment portfolio tracking and EMI (loan / credit-card) amortization management in one unified, encrypted dashboard.

---

## Monorepo layout

This repository is a pnpm + Turborepo workspace.

- `apps/web/` — the TanStack Start PWA
- `packages/db/` — Prisma schema, migrations, and generated client (`@phinio/db`)
- `packages/validators/` — shared Zod validators (`@phinio/validators`)
- `packages/calc/` — pure-math helpers for EMI / DPS / dashboard aggregations (`@phinio/calc`)
- `packages/design-tokens/` — Modern Noir token source + CSS generator (`@phinio/design-tokens`)

`apps/mobile/` (React Native) is planned for a later phase — see
`docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md`.

Install with `pnpm install` (auto-runs `prisma generate`). Then `pnpm dev` to start.

---

## Features

### Investment Portfolio

Three investment modes under one unified schema:

- **Lump-sum** — stocks, mutual funds, fixed deposits, gold, crypto, real estate, agro farms, businesses, sanchayapatra, and custom types. Log invested amount + current value; returns (%) are computed automatically. Mark completed with an exit value to record realised P&L.
- **DPS (scheduled)** — fixed monthly deposit over a tenure with simple or compound interest. Full installment schedule (with running accrued value) is generated up-front at creation. Mark individual installments paid; DPS auto-matures when every row is paid.
- **Savings pots (flexible)** — no tenure or interest math. Add ad-hoc deposits with amount / date / notes; the `investedAmount` syncs to the deposit sum. `currentValue` is user-maintained to reflect actual bank balance.
- **Withdrawals** — record partial withdrawals against lump-sum or savings; close an investment entirely from the same modal. DPS supports premature closure with realised payout.
- Per-investment notes, status tracking (`active`, `completed`, `matured`, `closed`), and a full activity log of every mutation.

### EMI Management

- Add bank loans or credit-card EMIs with principal, annual interest rate, and tenure
- Full amortization schedule generated upfront at creation — every payment row (principal split, interest split, remaining balance, due date) is stored, not computed on the fly
- Track payment status: upcoming, paid, overdue
- Mark individual installments as paid

### Unified Dashboard

- Net worth snapshot: `Σ active investment values − Σ active EMI remaining balances`
- Portfolio overview with total invested, current value, and overall return %
- Upcoming and overdue EMI payments at a glance
- Allocation donut with an interactive legend — tap a type to highlight its slice and visually mute the others

### Notifications

- **In-app** — bell icon with unread count, notification center with mark-all-read, link-through to the related screen
- **Web push** — optional browser push reminders for upcoming / overdue EMI and DPS installments, powered by VAPID + a Vercel cron worker
- **Activity history** — full audit trail of every create / update / delete across investments, deposits, withdrawals, EMIs, payments, and profile changes, with infinite-scroll pagination

### Auth & Security

- Email / password sign-up with mandatory email verification (powered by Resend)
- Forgot-password flow with time-limited reset links
- Cookie-based sessions managed by Better Auth (httpOnly, secure)
- Every database query is scoped to the authenticated user's `profileId` — no cross-user data leakage possible

### PWA

- Installable on Android and iOS (standalone display mode)
- Dark-only "Digital Private Bank" design system — nocturnal palette, glassmorphism, Manrope numerics + Inter body
- Safe-area aware — reserves space under the iOS Dynamic Island / notch and above the home indicator when installed
- Custom service worker adds push + `notificationclick` handlers on top of Workbox precache
- Public marketing and auth pages are prerendered at build time and served from the CDN for near-zero TTFB
- Optimised for mobile viewports; works in any modern browser

---

## Tech Stack

| Layer         | Technology                                                                               |
| ------------- | ---------------------------------------------------------------------------------------- |
| Framework     | TanStack Start (React 19 + Vite + SSR)                                                   |
| Routing       | TanStack Router (file-based, code-generated route tree, intent-preload loaders)          |
| Data fetching | TanStack Query (caching, mutations, optimistic updates, shared `queryOptions` factories) |
| Auth          | Better Auth with `tanstackStartCookies` plugin                                           |
| ORM           | Prisma 7 with `@prisma/adapter-pg` (pg adapter, not default engine)                      |
| Database      | PostgreSQL via Neon (serverless, pooled + direct URLs)                                   |
| Email         | Resend (verification links, password reset)                                              |
| Web Push      | `web-push` + VAPID, delivered via Vercel cron worker                                     |
| Styling       | Tailwind CSS v4 via `@tailwindcss/vite` — all tokens in `src/styles.css`                 |
| Validation    | Zod                                                                                      |
| Date math     | date-fns                                                                                 |
| Charts        | Recharts (lazy-loaded)                                                                   |
| PWA           | vite-plugin-pwa (Workbox `injectManifest`) + custom `src/sw.ts`                          |
| Deployment    | Vercel (Nitro preset with build-time prerender for public routes; Analytics)             |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A PostgreSQL database (Neon recommended — free tier works)
- A [Resend](https://resend.com) account with a verified sender domain
- A [Vercel](https://vercel.com) project (for production; optional for local dev)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable                | Description                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Pooled Neon connection string (used by the app at runtime via PgBouncer)                        |
| `DIRECT_URL`            | Direct (non-pooled) Neon connection string (used by `prisma migrate deploy`)                    |
| `BETTER_AUTH_SECRET`    | Random secret — generate with `npx -y @better-auth/cli secret`                                  |
| `BETTER_AUTH_URL`       | Full URL of the app (e.g. `http://localhost:3000` in dev, your Vercel URL in prod)              |
| `RESEND_API_KEY`        | API key from your Resend dashboard                                                              |
| `RESEND_FROM`           | Verified sender address, e.g. `Phinio <noreply@yourdomain.com>`                                 |
| `VAPID_PUBLIC_KEY`      | Web-push VAPID public key — generate a pair with `npx web-push generate-vapid-keys`             |
| `VAPID_PRIVATE_KEY`     | Web-push VAPID private key (server-only; never exposed to the client)                           |
| `VAPID_SUBJECT`         | `mailto:` or `https:` URI registered with the push service                                      |
| `VITE_VAPID_PUBLIC_KEY` | Same value as `VAPID_PUBLIC_KEY`, exposed to the client so `PushManager.subscribe()` can use it |
| `CRON_SECRET`           | Guards `/api/cron/send-reminders` — generate with `openssl rand -hex 32`                        |

> **`BETTER_AUTH_URL` gotcha:** Better Auth embeds this URL verbatim in every email link (verification, password reset). In dev it must be `http://localhost:3000`; in preview (`pnpm preview:local`, port 4173) temporarily set it to `http://localhost:4173` or links will 404.

### 3. Run database migrations and generate the Prisma client

```bash
pnpm db:migrate   # creates tables via prisma migrate dev
pnpm db:generate  # generates the typed client to packages/db/src/generated/
```

> All `db:*` scripts are wrapped in `dotenv -e ../../.env.local` — never run `npx prisma` directly or it won't pick up `DATABASE_URL`. Note: `pnpm install` already runs `db:generate` via postinstall, so on a fresh clone you only need `db:migrate`.

### 4. Start the development server

```bash
pnpm dev          # all apps in dev mode (turbo); web app on http://localhost:3000
```

---

## Scripts

```bash
pnpm dev                          # All apps in dev mode (turbo); web on :3000
pnpm --filter @phinio/web dev     # Just the web app on :3000
pnpm build                        # Production build via turbo (expects host-provided env)
pnpm build:local                  # Same build chain wrapped in dotenv -e .env.local for local testing
pnpm preview                      # Preview the production build on :4173 (expects host-provided env)
pnpm preview:local                # dotenv-wrapped preview for local testing

pnpm test                         # Vitest across the workspace via turbo
pnpm lint                         # ESLint across the workspace
pnpm check                        # prettier --write + eslint --fix (run before committing)

pnpm db:generate                  # prisma generate → packages/db/src/generated/
pnpm db:push                      # Push schema changes without a migration file (dev only)
pnpm db:migrate                   # prisma migrate dev (creates and applies a migration)
pnpm db:studio                    # Open Prisma Studio in the browser
pnpm db:seed                      # Run the seed script
```

> `pnpm build` and `pnpm preview` assume `DATABASE_URL` (and the other vars) come from the hosting platform — they will fail locally with `PrismaConfigEnvError`. Use `build:local` / `preview:local` for local prod-style testing; those wrap the chain with `dotenv -e .env.local`.

---

## Project Structure

```
apps/
└── web/                    # TanStack Start PWA
    └── src/
        ├── routes/
        │   ├── __root.tsx          # HTML shell, head tags, Toaster, Analytics, SW registration
        │   ├── index.tsx           # Landing page (prerendered)
        │   ├── login.tsx           # /login (prerendered)
        │   ├── signup.tsx          # /signup (prerendered)
        │   ├── check-email.tsx     # Post-signup email verification prompt (prerendered)
        │   ├── forgot-password.tsx # /forgot-password (prerendered)
        │   ├── api/
        │   │   ├── auth/$.ts       # Better Auth catch-all handler
        │   │   └── cron/send-reminders.ts  # Scheduled push-notification worker
        │   └── app/
        │       ├── route.tsx       # Auth guard + app shell layout (TopBar + BottomTabBar + FAB)
        │       ├── index.tsx       # /app — unified dashboard (loader-prefetched)
        │       ├── profile.tsx     # /app/profile — settings
        │       ├── activity/
        │       │   └── index.tsx   # /app/activity — infinite-scroll audit log
        │       ├── investments/
        │       │   ├── index.tsx   # Portfolio list (loader-prefetched)
        │       │   ├── new.tsx     # Add lump-sum investment
        │       │   ├── $id.edit.tsx
        │       │   ├── dps/
        │       │   │   ├── new.tsx
        │       │   │   └── $id.tsx
        │       │   └── savings/
        │       │       ├── new.tsx
        │       │       └── $id.tsx
        │       └── emis/
        │           ├── index.tsx   # EMI overview (loader-prefetched)
        │           ├── new.tsx     # Add EMI
        │           └── $emiId.tsx  # Amortization schedule detail
        ├── lib/
        │   ├── auth.ts             # Better Auth server config
        │   └── auth-client.ts      # Better Auth client hooks
        ├── server/
        │   └── auth.ts             # getSessionFn() server function
        ├── db.ts                   # PrismaClient singleton (imports from @phinio/db)
        └── styles.css              # Tailwind v4 @theme tokens + global utilities

packages/
├── db/
│   ├── prisma/
│   │   ├── schema.prisma   # Source of truth for DB schema
│   │   └── migrations/     # Migration history
│   └── src/
│       └── generated/      # Auto-generated Prisma client — do not edit (gitignored)
├── validators/             # Shared Zod validators (@phinio/validators)
├── calc/                   # EMI / DPS / dashboard math helpers (@phinio/calc)
└── design-tokens/          # Modern Noir token source + CSS generator (@phinio/design-tokens)

screens/
├── phinio_modern_noir/
│   └── DESIGN.md           # Design system: "Digital Private Bank" — read before touching UI
└── <screen_name>/
    ├── screen.png          # Static mockup reference
    └── code.html           # HTML reference for layout/markup

public/
├── phinio.png              # Full brand logo (P icon + wordmark)
├── phinio-square.png       # Icon mark only
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── apple-touch-icon.png    # 180×180 for iOS home screen
├── favicon.ico / favicon-*.png
└── site.webmanifest        # PWA manifest (linked from __root.tsx)
```

---

## Architecture

### Data Flow

```
Client component
  → TanStack Query (useQuery / useMutation)
    → createServerFn() handler
      → Better Auth session check
        → Prisma query scoped by profileId
```

### Key Conventions

- **Authorization is per-query, not per-route.** Every server function that touches user data derives `profileId` from the Better Auth session and includes it in the Prisma `where` clause.
- **Prisma client is imported from `@phinio/db`**, not from `@prisma/client` or a relative path. The generated output lives at `packages/db/src/generated/` (gitignored). After editing the schema, run `pnpm db:generate` before the types resolve.
- **Route tree is code-generated** to `apps/web/src/routeTree.gen.ts` — never edit it. Add route files under `apps/web/src/routes/` and the TanStack Router plugin regenerates it automatically.
- **Tailwind v4 — no `tailwind.config.js`.** All design tokens live under `@theme` in `apps/web/src/styles.css`. The app is dark-only; `<html>` has a permanent `className="dark"`.
- **Money fields are `Decimal(15,2)` in Prisma.** Handle them as strings or `Decimal` objects — never coerce to JS `number` for arithmetic.
- **EMI amortization and DPS schedules are pre-computed on creation.** All `EmiPayment` and `InvestmentDeposit` rows are generated upfront using the standard reducing-balance / DPS accrual formulas (see PRD §8). Do not compute schedules at read time.
- **Path aliases:** `#/*` and `@/*` resolve to `apps/web/src/*` within the web app. For shared packages use `@phinio/...` workspace names — never relative paths crossing package boundaries.
- **Hooks expose shared `queryOptions` factories** so route loaders and `useQuery` use the same keys / fetchers. Tab routes call `queryClient.ensureQueryData(factory())` in their `loader` — combined with `defaultPreload: 'intent'` this warms the cache before the user taps.
- **Public marketing / auth pages are prerendered** via Nitro (`vite.config.ts`), not server-rendered per request. Copy changes there require a redeploy to appear.

---

## Design System

All UI work must reference three sources in parallel:

1. **`screens/phinio_modern_noir/DESIGN.md`** — visual tokens, typography scale, the "No-Line Rule" (no 1px borders for sectioning), glassmorphism guidelines
2. **`screens/<screen_name>/code.html`** — HTML reference for layout and markup structure
3. **`screens/<screen_name>/screen.png`** — static mockup for visual reference

The palette is rooted in `#0b1326` (surface). Structural boundaries are defined through tonal surface shifts (`surface-container-low` vs `surface`), never divider lines. Manrope is used for all numerics and display text; Inter for body copy.

---

## Deployment

Phinio deploys to Vercel. On each deployment, `prisma migrate deploy` runs automatically before the build (configured in `package.json`).

For a full walkthrough — provisioning Neon, configuring Resend, generating VAPID keys, wiring the cron worker, and the production env-var matrix — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Documentation

- [`docs/Phinio_PRD_v1.md`](docs/Phinio_PRD_v1.md) — Product requirements (schema, screens, routes, business logic, implementation phases)
- [`docs/OFFLINE_PLAN.md`](docs/OFFLINE_PLAN.md) — Offline-first architecture (mutation queueing, idempotency, prefetch contract)
- [`docs/TASKS.md`](docs/TASKS.md) — Task breakdown derived from the PRD
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Production deployment guide
- [`screens/phinio_modern_noir/DESIGN.md`](screens/phinio_modern_noir/DESIGN.md) — Design system ("Digital Private Bank")
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Contribution workflow and conventions
- [`CHANGELOG.md`](CHANGELOG.md) — Release notes

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request — it covers branching, commit conventions, and the project-specific rules (per-query authorization, pre-computed schedules, offline-first mutation contract) that aren't enforced by the linter.

---

## License

Released under the [MIT License](LICENSE).
