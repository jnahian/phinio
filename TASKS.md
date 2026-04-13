# Phinio — Phase-by-Phase Task List

Derived from `Phinio_PRD_v1.md` §10. Tasks are roughly ordered within each phase; items marked with ⚠ have known pitfalls called out in `CLAUDE.md`.

---

## Phase 1 — Foundation

Goal: a logged-in user lands on an empty `/app` page backed by Neon + Prisma + Better Auth.

### Environment & database
- [ ] Provision a Neon Postgres project; copy the pooled connection string into `.env.local` as `DATABASE_URL`
- [ ] Generate `BETTER_AUTH_SECRET` via `npx -y @better-auth/cli secret` and add to `.env.local`
- [ ] Add `BETTER_AUTH_URL` to `.env.local` (dev: `http://localhost:3000`)

### Prisma schema
- [ ] Delete the placeholder `Todo` model in `prisma/schema.prisma`
- [ ] Add `Profile`, `Investment`, `Emi`, `EmiPayment` models per PRD §4.1 (with `@@map` snake_case table names, `Decimal(15,2)` for money, `@db.Date` for date-only fields)
- [ ] Add Better Auth's required models (`User`, `Session`, `Account`, `Verification`) — let `@better-auth/cli generate` emit the Prisma model block, then paste into `schema.prisma`
- [ ] Run `npm run db:generate` then `npm run db:migrate -- --name init`
- [ ] Delete `prisma/seed.ts` or rewrite it for real models
- [ ] Remove the `Todo`-era generated files under `src/generated/prisma/` if stale (regenerate fresh)

### Better Auth wiring
- [ ] Update `src/lib/auth.ts` to use the Prisma adapter pointing at `src/db.ts` ⚠ (import `PrismaClient` from `./generated/prisma/client.js`, not `@prisma/client`)
- [ ] Add a Better Auth `databaseHooks.user.create.after` hook that creates a `Profile` row linked by `userId` with `fullName` + `preferredCurrency` from signup metadata
- [ ] Extend signup fields via `additionalFields` for `fullName` + `preferredCurrency` (`"BDT" | "USD"`)
- [ ] Confirm `src/routes/api/auth/$.ts` still forwards to `auth.handler` (already in place)
- [ ] Create `src/lib/auth-client.ts` with `createAuthClient()` + typed session hook export (already stubbed — verify it resolves the Better Auth URL)

### Auth UI
- [ ] Add `src/lib/validators.ts` with Zod schemas for login, signup, forgot-password
- [ ] Build `src/routes/login.tsx` per PRD §5.2 (email, password w/ show-hide, submit, error toasts, loading state)
- [ ] Build `src/routes/signup.tsx` per PRD §5.3 (name, email, password, BDT/USD currency toggle)
- [ ] Build `src/routes/forgot-password.tsx` per PRD §5.4
- [ ] Build `src/routes/index.tsx` splash/welcome per PRD §5.1 (auto-redirect to `/app` if session exists)

### Route protection
- [ ] Create `src/routes/app/route.tsx` with `beforeLoad` that calls `auth.api.getSession()` server-side and redirects to `/login` if missing
- [ ] Add redirect guards on `/`, `/login`, `/signup` → `/app` when session exists

### Cleanup
- [ ] Remove `src/routes/about.tsx` and any `demo/` artifacts
- [ ] Delete placeholder `Header`/`Footer` usage from `__root.tsx` (the real layout will live under `/app`)

---

## Phase 2 — App Shell

Goal: a user can navigate between all four main tabs and see branded empty screens using the Modern Noir design system.

### Design system foundation
- [ ] Import Manrope + Inter via Google Fonts or self-host in `public/fonts` and register in `src/styles.css`
- [ ] Define Tailwind v4 `@theme` tokens in `src/styles.css` for the Modern Noir palette (`surface`, `surface-container-low/high/highest/lowest`, `primary`, `primary-container`, `secondary`, `tertiary-container`, `outline-variant`, etc.) per `screens/phinio_modern_noir/DESIGN.md` §2
- [ ] Add typography scale utilities (`display-lg`, `headline-lg/md/sm`, `body-md`, `label-sm/md`) per DESIGN.md §3
- [ ] Wire dark-mode tokens to the existing pre-hydration theme script (`__root.tsx`) ⚠ keep theme resolution in the inline script, not React state
- [ ] Override the shell body in `__root.tsx` to drop Header/Footer for `/app/*` and `/login` etc.

### Layout & navigation
- [ ] Build `src/components/BottomTabBar.tsx` — 4 tabs (Home, Investments, EMIs, Profile), 60–64px tall with safe-area padding, active-tab accent color
- [ ] Use `BottomTabBar` in `src/routes/app/route.tsx`; hide on sub-screens (detail pages, forms) — use a route-level flag or layout-split route file
- [ ] Build `src/routes/app/index.tsx` home shell: greeting + placeholder hero card
- [ ] Build `src/routes/app/investments/index.tsx` stub with empty state
- [ ] Build `src/routes/app/emis/index.tsx` stub with empty state
- [ ] Build `src/routes/app/profile.tsx` with name, email, currency toggle, theme toggle, logout

### Reusable primitives
- [ ] `src/components/ui/EmptyState.tsx` — illustration slot + heading + CTA
- [ ] `src/components/ui/Card.tsx` — rounded 16px, `surface-container-high` fill, no borders
- [ ] `src/components/ui/Button.tsx` — primary / secondary (ghost border) / tertiary variants per DESIGN.md §5
- [ ] `src/components/ui/Input.tsx` — carved `surface-container-lowest` fill, primary-focus border
- [ ] `src/components/ui/FAB.tsx` — bottom-right fixed, primary-container fill
- [ ] `src/components/ui/FilterPills.tsx` — horizontal-scroll pill group with active state
- [ ] `src/components/ui/SummaryHeroCard.tsx` — gradient hero for page tops
- [ ] `src/components/ui/ProgressBar.tsx` — 4px thin track per DESIGN.md §5
- [ ] `src/lib/currency.ts` — format `Decimal`/string amounts as BDT (৳) or USD ($) based on profile preference ⚠ never coerce to `number`
- [ ] `src/lib/cn.ts` — classname merge utility

### Profile page functionality
- [ ] Server function: `updateProfileCurrency({ preferredCurrency })`
- [ ] Server function: `signOut()` using Better Auth
- [ ] Profile page wires the currency toggle + logout with confirmation dialog

---

## Phase 3 — Investments

Goal: full CRUD for investments with active/completed lifecycle.

### Server layer
- [ ] `src/server/investments.ts` with `createServerFn()` handlers: `listInvestments({ status, type })`, `getInvestment(id)`, `createInvestment(input)`, `updateInvestment(id, input)`, `deleteInvestment(id)`
- [ ] Every handler must resolve `profileId` from Better Auth session and scope the `where` clause ⚠
- [ ] Zod input schemas in `src/lib/validators.ts` for investment create/update (amount > 0, required fields, completed state requires `exitValue` + `completedAt`)

### Hooks
- [ ] `src/hooks/useInvestments.ts` — `useInvestmentsQuery`, `useInvestmentQuery`, `useCreateInvestment`, `useUpdateInvestment`, `useDeleteInvestment`
- [ ] Invalidate `["investments", ...]` and `["dashboard-stats"]` on every mutation (PRD §7.2)

### UI
- [ ] `src/routes/app/investments/index.tsx` — summary card (Total Invested / Current Value / Total Returns), filter pills, active/completed tabs, cards list, FAB (PRD §5.6)
- [ ] `InvestmentCard` component — name, color-coded type badge, amounts, return % green/red
- [ ] `src/routes/app/investments/new.tsx` — full-page form with back arrow (PRD §5.7)
- [ ] `src/routes/app/investments/$id.edit.tsx` — edit form with status toggle revealing exit-value + completed-date fields
- [ ] Delete confirmation dialog
- [ ] Return % calculation helper in `src/lib/calculations.ts` ⚠ Decimal-safe

---

## Phase 4 — EMI Manager

Goal: create an EMI, auto-generate the amortization schedule, and mark payments paid/unpaid.

### Business logic
- [ ] `src/lib/emi-calculator.ts` — `calculateEmi({ principal, annualRate, tenureMonths })` and `generateAmortization({ principal, annualRate, tenureMonths, startDate })` returning `EmiPayment[]` rows per PRD §9.2
- [ ] Unit tests (`*.test.ts`) for EMI formula edge cases (0% interest, single-month tenure, rounding)
- [ ] Decimal arithmetic throughout — use `Prisma.Decimal` or string-based math ⚠

### Server layer
- [ ] `src/server/emis.ts`: `listEmis({ type })`, `getEmi(emiId)` (includes payments), `createEmi(input)` (generates + inserts all payment rows in a single transaction), `deleteEmi(id)` (cascade), `markPaymentPaid({ paymentId, paid })`
- [ ] Zod schemas for EMI create input
- [ ] `profileId` scoping on every query ⚠

### Hooks
- [ ] `src/hooks/useEmis.ts` — list/detail/create/delete queries + `useMarkPaymentPaid` mutation with **optimistic update** on the payments list (PRD §7.3)
- [ ] Invalidate `["emis"]`, `["emis", emiId]`, `["dashboard-stats"]`, `["upcoming-payments"]` on mutations

### UI
- [ ] `src/routes/app/emis/index.tsx` — summary card, filter pills (All / Bank Loan / Credit Card), EMI cards with progress bar + next due date, FAB (PRD §5.8)
- [ ] `src/routes/app/emis/new.tsx` — add form with **live EMI preview card** that recalculates as user types principal/rate/tenure (PRD §5.9)
- [ ] `src/routes/app/emis/$emiId.tsx` — EMI detail with key stats row, principal-vs-interest donut chart, scrollable amortization table with paid checkboxes, overdue row highlighting, summary footer (PRD §5.10)
- [ ] Overdue detection helper (client-side: `dueDate < today && status !== 'paid'`) per PRD §9.2
- [ ] Delete EMI confirmation (cascade deletes all payment rows)
- [ ] Install `recharts` and build the donut chart component

---

## Phase 5 — Dashboard & Polish

Goal: the home screen pulls everything together, and the app feels finished.

### Dashboard
- [ ] `src/server/dashboard.ts` — single `getDashboardStats()` server function that aggregates: net worth, total investment value + gain/loss %, monthly EMI outflow, upcoming payments (next 5 within 30 days), investment allocation grouped by type
- [ ] `src/hooks/useDashboard.ts` — `useDashboardQuery`
- [ ] Home screen net-worth hero card with gradient + glassmorphism per DESIGN.md §2
- [ ] Home screen quick-stats row (2 cards)
- [ ] Home screen upcoming payments list — tapping a row navigates to `/app/emis/$emiId`
- [ ] Home screen investment allocation mini donut chart

### Polish
- [ ] Loading skeletons for every list/detail screen (use `surface-container-low` shimmer)
- [ ] Error boundaries + toast notifications for mutation success/failure
- [ ] Page transitions — slide-in from right for sub-screens
- [ ] Confirmation dialogs standardized across delete actions
- [ ] Empty-state illustrations for all list screens
- [ ] Responsive audit across 320px–428px viewports, spot-check up to 768px
- [ ] Accessibility pass — WCAG 2.1 AA: labels, contrast, keyboard nav, focus rings
- [ ] Lighthouse mobile run — target FCP < 1.5s on 4G
- [ ] Favicon + PWA manifest + app icons in `public/`
- [ ] Update `<title>` and meta tags in `__root.tsx` from "TanStack Start Starter" to "Phinio"
