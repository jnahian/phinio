# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product context

Phinio is a mobile-first PWA for personal finance — investment portfolio tracking and EMI (loan/credit-card) amortization management. Full requirements live in `docs/Phinio_PRD_v1.md` (schema, screens, routes, business logic, implementation phases). Static HTML/PNG mockups for each screen sit in `screens/<screen_name>/`.

## Reference docs (read these before non-trivial work)

| Doc                                    | When to read                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md`                 | High-level system design — layers, RPC pattern, cross-cutting concerns.      |
| `docs/SCHEMAS.md`                      | Data model invariants beyond what `prisma/schema.prisma` shows.              |
| `docs/WORKFLOWS.md`                    | Canonical recipes — server fns, mutations, EMI creation, activity log, cron. |
| `docs/design.md`                       | Design-system cheat sheet (Modern Noir tokens & rules).                      |
| `screens/phinio_modern_noir/DESIGN.md` | Full design system — authoritative source for visual tokens.                 |
| `docs/Phinio_PRD_v1.md`                | Behavior, business logic, implementation phases.                             |
| `docs/OFFLINE_PLAN.md`                 | Offline-first strategy phases and decisions.                                 |

## Commands

```bash
pnpm dev                          # all apps in dev mode (turbo)
pnpm --filter @phinio/web dev     # just the web app on :3000
pnpm build                        # production build via turbo
pnpm build:local                  # local-env build (dotenv -e .env.local wrapped)
pnpm test                         # vitest across the workspace
pnpm lint                         # eslint across the workspace
pnpm check                        # prettier --write + eslint --fix

pnpm db:generate                  # prisma generate against packages/db/prisma/schema.prisma
pnpm db:push                      # push schema without migration (dev)
pnpm db:migrate                   # prisma migrate dev
pnpm db:studio
pnpm db:seed
```

`pnpm install` automatically runs `db:generate` (postinstall hook), so a fresh clone is ready immediately. The `db:*` scripts under `packages/db` are still wrapped in `dotenv -e ../../.env.local` — Prisma commands must be invoked through the pnpm scripts, not `npx prisma` directly, or they won't pick up `DATABASE_URL`.

Run a single test file: `pnpm --filter @phinio/web exec vitest run path/to/file.test.ts` (or omit `run` for watch mode).

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

**Database:** Prisma 7 with the **pg adapter** (`@prisma/adapter-pg`), not the default engine. The generated client is emitted to `packages/db/src/generated/` (gitignored — produced by the `postinstall` hook). `apps/web/src/db.ts` imports `PrismaClient` from `@phinio/db` — **not** `@prisma/client` or a relative path. The client is memoized on `globalThis.__prisma` in dev to survive HMR. The schema lives at `packages/db/prisma/schema.prisma`. After editing the schema, run `pnpm db:generate` before the types will resolve.

`packages/db/prisma/schema.prisma` owns both the Better Auth core models (`User`, `Session`, `Account`, `Verification` — generated via `npx @better-auth/cli@latest generate`) and the Phinio domain models (`Profile`, `Investment`, `Emi`, `EmiPayment`) per PRD §4.1. The Better Auth CLI regenerates its own tables in-place if you change `additionalFields` or plugins; domain models stay hand-authored.

**Path aliases:** `#/*` and `@/*` still map to `./src/*` but each app declares them in its own tsconfig. For `apps/web`, the alias is scoped to `apps/web/src/`. For shared code that lives outside the app, use the workspace package names (`@phinio/validators`, `@phinio/calc`, `@phinio/db`, `@phinio/design-tokens`) — never relative paths crossing package boundaries.

**Styling:** Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js` — all tokens live under `@theme` in `src/styles.css`). The app is **dark-only** per Modern Noir (`screens/phinio_modern_noir/DESIGN.md`); `<html>` sits permanently in `className="dark"` and there is no theme toggle.

**BETTER_AUTH_URL gotcha:** Better Auth embeds this env var verbatim into every email link (verification, password reset). In dev (`pnpm dev` on :3000) it Just Works. In `pnpm preview` (:4173) the links point at :3000 and will 404 unless you temporarily set `BETTER_AUTH_URL=http://localhost:4173` before starting preview.

## Working on this project

- When implementing screens, cross-reference three sources: the PRD section for behavior, `screens/<name>/code.html` for layout/markup reference, and `screens/phinio_modern_noir/DESIGN.md` for the visual tokens. The HTML mockups are reference material, not code to import.
- PRD §10 defines implementation phases (Foundation → App Shell → Investments → EMI Manager → Dashboard) — follow that order unless the user says otherwise.
- Schema, validators, EMI/DPS math, and design tokens are workspace packages. Edit them at their source (`packages/<name>/`) — the web app imports them via `@phinio/...` names, never via relative paths.
- EMI amortization: when an EMI is created, the server function must generate all `EmiPayment` rows up front using the formulas in PRD §9.2. Do not compute the schedule on read.
- Money fields are `Decimal(15,2)` in Prisma — handle them as strings/Decimal, never coerce to JS `number` for arithmetic.
