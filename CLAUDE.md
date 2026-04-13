# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product context

Phinio is a mobile-first PWA for personal finance — investment portfolio tracking and EMI (loan/credit-card) amortization management. Full requirements live in `Phinio_PRD_v1.md` (schema, screens, routes, business logic, implementation phases). Design system for all UI work is `screens/phinio_modern_noir/DESIGN.md` ("Digital Private Bank" aesthetic — nocturnal palette, no 1px borders for sectioning, tonal surface layering, Manrope for numerics + Inter for body). Static HTML/PNG mockups for each screen sit in `screens/<screen_name>/`.

## Commands

```bash
npm run dev          # Vite dev server on :3000
npm run build        # Production build
npm run test         # Vitest (run once, not watch)
npm run lint         # ESLint (TanStack config)
npm run format       # prettier --check
npm run check        # prettier --write + eslint --fix  (run before committing)

npm run db:generate  # prisma generate
npm run db:push      # push schema without migration (dev)
npm run db:migrate   # prisma migrate dev
npm run db:studio
npm run db:seed
```

All `db:*` scripts are wrapped in `dotenv -e .env.local` — Prisma commands must be invoked through the npm scripts, not `npx prisma` directly, or they won't pick up `DATABASE_URL`.

Run a single test file: `npx vitest run path/to/file.test.ts` (or `npx vitest path/to/file.test.ts` for watch).

## Architecture

**Framework:** TanStack Start (React 19 + Vite 8 + SSR). File-based routing via `@tanstack/router-plugin`; the router tree is code-generated to `src/routeTree.gen.ts` — never edit that file, add route files under `src/routes/` and the plugin regenerates it.

**Routing root:** `src/router.tsx` constructs the router with a `QueryClient` context and wires `setupRouterSsrQueryIntegration` so TanStack Query state hydrates across SSR → client. `src/routes/__root.tsx` is the shell (html/head/body, theme init script, devtools). Any new root-level chrome goes there.

**Data flow (target pattern from the PRD):**
```
Client component
  → TanStack Query (useQuery / useMutation)
    → createServerFn() handler
      → Better Auth session check
        → Prisma query scoped by profileId
```
Every server function that touches user data must derive `profileId` from the Better Auth session and include it in the `where` clause — authorization is per-query, not per-route.

**Auth:** Better Auth (`src/lib/auth.ts`) with the `tanstackStartCookies()` plugin. The catch-all route `src/routes/api/auth/$.ts` forwards GET/POST to `auth.handler(request)` — that single file handles every Better Auth endpoint. Client-side hooks live in `src/lib/auth-client.ts`. `BETTER_AUTH_SECRET` must be set in `.env.local`; generate one with `npx -y @better-auth/cli secret`.

**Database:** Prisma 7 with the **pg adapter** (`@prisma/adapter-pg`), not the default engine. The generated client is emitted to `src/generated/prisma/` (see `prisma/schema.prisma` `output` field), so `src/db.ts` imports `PrismaClient` from `./generated/prisma/client.js` — **not** `@prisma/client`. The client is memoized on `globalThis.__prisma` in dev to survive HMR. After editing `schema.prisma`, run `npm run db:generate` before the types will resolve.

The current `schema.prisma` only contains a placeholder `Todo` model. The real schema (`Profile`, `Investment`, `Emi`, `EmiPayment`) is specified in PRD §4.1 and still needs to be added. Better Auth owns its own tables (`user`, `session`, `account`, `verification`) — do not model them in Prisma.

**Path aliases:** `#/*` and `@/*` both map to `src/*` (tsconfig + `package.json` `imports`). Existing code uses `#/lib/auth` style; follow that.

**Styling:** Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js` — config is in `src/styles.css`). Theme switching is done by a pre-hydration inline script in `__root.tsx` that reads `localStorage.theme` and toggles `light`/`dark` classes + `color-scheme` on `<html>` before React mounts; don't move theme resolution into React state or you'll reintroduce FOUC.

## Working on this project

- When implementing screens, cross-reference three sources: the PRD section for behavior, `screens/<name>/code.html` for layout/markup reference, and `screens/phinio_modern_noir/DESIGN.md` for the visual tokens. The HTML mockups are reference material, not code to import.
- PRD §10 defines implementation phases (Foundation → App Shell → Investments → EMI Manager → Dashboard) — follow that order unless the user says otherwise.
- EMI amortization: when an EMI is created, the server function must generate all `EmiPayment` rows up front using the formulas in PRD §9.2. Do not compute the schedule on read.
- Money fields are `Decimal(15,2)` in Prisma — handle them as strings/Decimal, never coerce to JS `number` for arithmetic.
