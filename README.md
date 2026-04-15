# Phinio

**Your private financial vault.** A mobile-first Progressive Web App for personal finance — investment portfolio tracking and EMI (loan / credit-card) amortization management in one unified, encrypted dashboard.

---

## Features

### Investment Portfolio
- Track stocks, mutual funds, fixed deposits, gold, crypto, and custom asset types
- Log invested amount and current value; returns (%) are computed automatically
- Mark investments as completed with an exit value to record realised P&L
- Per-investment notes and status tracking (active / completed)

### EMI Management
- Add bank loans or credit-card EMIs with principal, annual interest rate, and tenure
- Full amortization schedule generated upfront at creation — every payment row (principal split, interest split, remaining balance, due date) is stored, not computed on the fly
- Track payment status: upcoming, paid, overdue
- Mark individual installments as paid

### Unified Dashboard
- Net worth snapshot: `Σ active investment values − Σ active EMI remaining balances`
- Portfolio overview with total invested, current value, and overall return %
- Upcoming and overdue EMI payments at a glance

### Auth & Security
- Email / password sign-up with mandatory email verification (powered by Resend)
- Forgot-password flow with time-limited reset links
- Cookie-based sessions managed by Better Auth (httpOnly, secure)
- Every database query is scoped to the authenticated user's `profileId` — no cross-user data leakage possible

### PWA
- Installable on Android and iOS (standalone display mode)
- Dark-only "Digital Private Bank" design system — nocturnal palette, glassmorphism, Manrope numerics + Inter body
- Optimised for mobile viewports; works in any modern browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19 + Vite + SSR) |
| Routing | TanStack Router (file-based, code-generated route tree) |
| Data fetching | TanStack Query (caching, mutations, optimistic updates) |
| Auth | Better Auth with `tanstackStartCookies` plugin |
| ORM | Prisma 7 with `@prisma/adapter-pg` (pg adapter, not default engine) |
| Database | PostgreSQL via Neon (serverless, pooled + direct URLs) |
| Email | Resend (verification links, password reset) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` — all tokens in `src/styles.css` |
| Validation | Zod |
| Date math | date-fns |
| Charts | Recharts |
| Deployment | Vercel (with Vercel Analytics) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon recommended — free tier works)
- A [Resend](https://resend.com) account with a verified sender domain
- A [Vercel](https://vercel.com) project (for production; optional for local dev)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Pooled Neon connection string (used by the app at runtime via PgBouncer) |
| `DIRECT_URL` | Direct (non-pooled) Neon connection string (used by `prisma migrate deploy`) |
| `BETTER_AUTH_SECRET` | Random secret — generate with `npx -y @better-auth/cli secret` |
| `BETTER_AUTH_URL` | Full URL of the app (e.g. `http://localhost:3000` in dev, your Vercel URL in prod) |
| `RESEND_API_KEY` | API key from your Resend dashboard |
| `RESEND_FROM` | Verified sender address, e.g. `Phinio <noreply@yourdomain.com>` |

> **`BETTER_AUTH_URL` gotcha:** Better Auth embeds this URL verbatim in every email link (verification, password reset). In dev it must be `http://localhost:3000`; in preview (`npm run preview`, port 4173) you must temporarily set it to `http://localhost:4173` or links will 404.

### 3. Run database migrations and generate the Prisma client

```bash
npm run db:migrate   # creates tables via prisma migrate dev
npm run db:generate  # generates the typed client to src/generated/prisma/
```

> All `db:*` scripts are wrapped in `dotenv -e .env.local` — never run `npx prisma` directly or it won't pick up `DATABASE_URL`.

### 4. Start the development server

```bash
npm run dev          # Vite dev server on http://localhost:3000
```

---

## Scripts

```bash
npm run dev          # Development server on :3000
npm run build        # Production build (runs migrations + prisma generate first)
npm run preview      # Preview the production build locally on :4173

npm run test         # Vitest (run once)
npm run lint         # ESLint (TanStack config)
npm run format       # Prettier --check
npm run check        # prettier --write + eslint --fix (run before committing)

npm run db:generate  # prisma generate → src/generated/prisma/
npm run db:push      # Push schema changes without a migration file (dev only)
npm run db:migrate   # prisma migrate dev (creates and applies a migration)
npm run db:studio    # Open Prisma Studio in the browser
npm run db:seed      # Run the seed script
```

---

## Project Structure

```
src/
├── routes/
│   ├── __root.tsx          # HTML shell, head tags, Toaster, Analytics
│   ├── index.tsx           # Landing page (always public)
│   ├── login.tsx           # /login
│   ├── signup.tsx          # /signup
│   ├── check-email.tsx     # Post-signup email verification prompt
│   ├── forgot-password.tsx # /forgot-password
│   └── app/
│       ├── route.tsx       # Auth guard + app shell layout
│       ├── index.tsx       # /app — unified dashboard
│       ├── profile.tsx     # /app/profile — settings
│       ├── investments/
│       │   ├── index.tsx   # Portfolio list
│       │   ├── new.tsx     # Add investment
│       │   └── $id.edit.tsx
│       └── emis/
│           ├── index.tsx   # EMI overview
│           ├── new.tsx     # Add EMI
│           └── $emiId.tsx  # Amortization schedule detail
├── lib/
│   ├── auth.ts             # Better Auth server config
│   └── auth-client.ts      # Better Auth client hooks
├── server/
│   └── auth.ts             # getSessionFn() server function
├── db.ts                   # PrismaClient singleton (memoised on globalThis in dev)
├── generated/
│   └── prisma/             # Auto-generated Prisma client — do not edit
└── styles.css              # Tailwind v4 @theme tokens + global utilities

prisma/
├── schema.prisma           # Source of truth for DB schema
└── migrations/             # Migration history

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
- **Prisma client is imported from `src/generated/prisma/client.js`**, not from `@prisma/client`. The `output` field in `schema.prisma` points there. After editing the schema, run `npm run db:generate` before the types resolve.
- **Route tree is code-generated** to `src/routeTree.gen.ts` — never edit it. Add route files under `src/routes/` and the TanStack Router plugin regenerates it automatically.
- **Tailwind v4 — no `tailwind.config.js`.** All design tokens live under `@theme` in `src/styles.css`. The app is dark-only; `<html>` has a permanent `className="dark"`.
- **Money fields are `Decimal(15,2)` in Prisma.** Handle them as strings or `Decimal` objects — never coerce to JS `number` for arithmetic.
- **EMI amortization is pre-computed on creation.** When an EMI is saved, all `EmiPayment` rows are generated upfront using the standard reducing-balance formula (see PRD §9.2). Do not compute the schedule at read time.
- **Path aliases:** `#/*` and `@/*` both resolve to `src/*`. Existing code uses the `#/` style; follow that.

---

## Design System

All UI work must reference three sources in parallel:

1. **`screens/phinio_modern_noir/DESIGN.md`** — visual tokens, typography scale, the "No-Line Rule" (no 1px borders for sectioning), glassmorphism guidelines
2. **`screens/<screen_name>/code.html`** — HTML reference for layout and markup structure
3. **`screens/<screen_name>/screen.png`** — static mockup for visual reference

The palette is rooted in `#0b1326` (surface). Structural boundaries are defined through tonal surface shifts (`surface-container-low` vs `surface`), never divider lines. Manrope is used for all numerics and display text; Inter for body copy.

---

## Deployment

The app deploys to Vercel. On each deployment, `prisma migrate deploy` runs automatically before the build (configured in `package.json` build script).

Set all environment variables listed in `.env.example` in your Vercel project settings. Use the **pooled** Neon URL for `DATABASE_URL` and the **direct** (non-pooled) URL for `DIRECT_URL` — Prisma migrations require a direct connection and will fail against PgBouncer.
