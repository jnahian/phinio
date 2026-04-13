# Phinio — Phase-by-Phase Task List

Derived from `Phinio_PRD_v1.md` §10. Tasks are roughly ordered within each phase; items marked with ⚠ have known pitfalls called out in `CLAUDE.md`.

---

## Phase 1 — Foundation ✅ COMPLETE

Goal: a logged-in user lands on an empty `/app` page backed by Neon + Prisma + Better Auth.

### Environment & database
- [x] Provision a Neon Postgres project; copy the pooled connection string into `.env.local` as `DATABASE_URL`
- [x] Generate `BETTER_AUTH_SECRET` via `npx -y @better-auth/cli secret` and add to `.env.local`
- [x] Add `BETTER_AUTH_URL` to `.env.local` (dev: `http://localhost:3000`)

### Prisma schema
- [x] Delete the placeholder `Todo` model in `prisma/schema.prisma`
- [x] Add `Profile`, `Investment`, `Emi`, `EmiPayment` models per PRD §4.1 (with `@@map` snake_case table names, `Decimal(15,2)` for money, `@db.Date` for date-only fields)
- [x] Add Better Auth's required models (`User`, `Session`, `Account`, `Verification`) — generated via `@better-auth/cli generate`
- [x] Run `npm run db:generate` then `npm run db:migrate -- --name init`
- [x] Delete `prisma/seed.ts` and remove the `db:seed` script from `package.json`
- [x] `src/generated/` added to `.gitignore`

### Better Auth wiring
- [x] `src/lib/auth.ts` uses the Prisma adapter pointing at `src/db.ts`
- [x] `databaseHooks.user.create.after` creates a linked `Profile` row
- [x] `preferredCurrency` exposed as a required `additionalField` on `User` (fullName uses built-in `user.name`)
- [x] `src/routes/api/auth/$.ts` forwards to `auth.handler`
- [x] `src/lib/auth-client.ts` uses `inferAdditionalFields<typeof auth>()` for typed signup
- [x] Resend mailer wired to `sendResetPassword` (falls back to `console.warn` when `RESEND_API_KEY` is unset)

### Auth UI
- [x] `src/lib/validators.ts` with Zod schemas for login, signup, forgot-password
- [x] `src/routes/login.tsx` — Modern Noir glass card with email, password (show/hide), error states
- [x] `src/routes/signup.tsx` — full name, email, password, BDT/USD currency toggle
- [x] `src/routes/forgot-password.tsx` with success state
- [x] `src/routes/index.tsx` splash with auto-redirect when session exists

### Route protection
- [x] `src/routes/app/route.tsx` with `beforeLoad` session guard via `getSessionFn` server function
- [x] Redirect guards on `/`, `/login`, `/signup` → `/app` when session exists
- [x] `src/server/auth.ts` with shared `getSessionFn` helper

### Design system foundation (pulled forward from Phase 2)
- [x] Inter + Manrope fonts imported in `src/styles.css`
- [x] Tailwind v4 `@theme` tokens for Modern Noir palette (surface hierarchy, primary/secondary/tertiary, outline-variant)
- [x] Typography scale utilities (`display-lg`, `headline-lg/md/sm`, `body-md`, `label-sm/md`)
- [x] Utility classes for `glass`, `input-carved`, `btn-primary`, `btn-ghost`, `noir-bg`

### Cleanup
- [x] Removed `src/routes/about.tsx`
- [x] Removed `Header.tsx`, `Footer.tsx`, `ThemeToggle.tsx`, `src/integrations/better-auth/header-user.tsx`
- [x] `__root.tsx` reduced to a bare shell (devtools only)

### Verified end-to-end
- [x] POST `/api/auth/sign-up/email` → User + Profile + Session rows in Neon
- [x] Session cookie authenticates `/app` and renders the greeting
- [x] Unauthenticated `/app` → 307 redirect to `/login`
- [x] `npm run build` and `npm run lint` clean

---

## Phase 2 — App Shell ✅ COMPLETE

Goal: a user can navigate between all four main tabs and see branded empty screens using the Modern Noir design system.

### Layout & navigation
- [x] `src/components/BottomTabBar.tsx` — 4 tabs (Home, Investments, EMIs, Profile) with safe-area padding, lucide icons, active pill accent
- [x] `BottomTabBar` mounted in `src/routes/app/route.tsx`; sub-screen hiding deferred until first sub-screen is introduced in Phase 3
- [x] Fleshed out `src/routes/app/index.tsx` home shell: greeting, gradient net-worth hero, Invested + Monthly EMI quick stats, upcoming payments empty card
- [x] `src/routes/app/investments/index.tsx` stub with summary card + empty state
- [x] `src/routes/app/emis/index.tsx` stub with summary card + empty state
- [x] `src/routes/app/profile.tsx` with initials avatar, name, email, currency toggle, logout

### Reusable primitives
- [x] `src/components/ui/EmptyState.tsx`
- [x] `src/components/ui/Card.tsx`
- [x] `src/lib/currency.ts` — Decimal-safe formatter for BDT/USD
- [x] `src/lib/cn.ts` — className merge utility

### Profile page functionality
- [x] `src/server/profile.ts` — `getProfileFn` (loaded in `/app` beforeLoad) and `updateProfileCurrencyFn` (Zod-validated, session-scoped)
- [x] Profile page wires the currency toggle (optimistic with router.invalidate) + logout with confirmation

### Verified end-to-end
- [x] Fresh-DB signup with `preferredCurrency: "USD"` → session-scoped profile loads on every tab
- [x] `$0.00` renders on home/investments/EMIs (currency flows through `formatCurrency`)
- [x] Initials avatar computed from `fullName`
- [x] Bottom tab bar present on all 4 routes, empty states visible
- [x] `npm run build` and `npm run lint` clean

### Known deferrals (not blockers)
- Sub-screen tab-bar hiding — add when the first sub-screen lands (investment/EMI form in Phase 3/4)
- Theme toggle — skipped; app is dark-only per Modern Noir design system

---

## Phase 3 — Investments ✅ COMPLETE

Goal: full CRUD for investments with active/completed lifecycle.

### Server layer
- [x] `src/server/investments.ts` — `listInvestmentsFn({ status, type })`, `getInvestmentFn`, `createInvestmentFn`, `updateInvestmentFn`, `deleteInvestmentFn`
- [x] Every handler resolves `profileId` via `requireProfileId()` helper and scopes the `where` clause
- [x] `serializeInvestment()` converts Prisma Decimal fields to strings before crossing the server-function boundary
- [x] Zod schemas in `src/lib/validators.ts`: `investmentCreateSchema`, `investmentUpdateSchema` (conditional exitValue/completedAt requirement), `investmentListQuerySchema`, `investmentIdSchema`, `INVESTMENT_TYPES` export

### Hooks
- [x] `src/hooks/useInvestments.ts` — `useInvestmentsQuery`, `useInvestmentQuery`, `useCreateInvestment`, `useUpdateInvestment`, `useDeleteInvestment`, shared `investmentKeys` factory
- [x] Mutations invalidate `["investments"]` and `["dashboard-stats"]`; updates also invalidate the detail key

### UI
- [x] `src/routes/app/investments/index.tsx` — summary card (Invested / Current or Exited / Return %), Active/Completed tab toggle, filter pills for type, card list with loading and empty states, FAB to /new
- [x] `InvestmentCard` inline component — color-coded type badge, current value, return % (green/red/neutral)
- [x] `src/routes/app/investments/new.tsx` — back-arrow header, asset details card, 3×2 category grid with icons, notes textarea, fixed bottom save button
- [x] `src/routes/app/investments/$id.edit.tsx` — prefills from `useInvestmentQuery`, status toggle reveals exit value + completed-on date, confirmation-dialog delete, fixed bottom save button
- [x] `src/lib/calculations.ts` — `calculateReturnPercent`, `calculateProfitLoss`, `formatReturnPercent`

### Primitives added
- [x] `src/components/ui/FAB.tsx` — fixed bottom-right, safe-area aware
- [x] `src/components/ui/FilterPills.tsx` — horizontal-scroll pill group with active state
- [x] `src/components/ui/TextField.tsx` — carved inputs with leading icon / prefix / error; also exports `TextArea`

### Sub-screen navigation
- [x] `/app/route.tsx` reads `staticData.hideTabBar` via `useMatches()` and hides the `BottomTabBar` on sub-screens; `/app/investments/new` and `/app/investments/$id/edit` both opt in

### Verified end-to-end
- [x] Direct Prisma smoke test against Neon: create 3 investments across types/statuses, list active (2), list completed (1), filter by type (1), update, verify profile-scoped update prevents cross-profile writes, deleteMany scoped by profileId, cleanup
- [x] Production build renders /app/investments (filter pills, tabs, loading state) and /app/investments/new (form sections)
- [x] Bottom tab bar visible on list, hidden on sub-screens
- [x] `npm run build`, `npx tsc --noEmit`, and `npm run lint` all clean

---

## Phase 4 — EMI Manager ✅ COMPLETE

Goal: create an EMI, auto-generate the amortization schedule, and mark payments paid/unpaid.

### Business logic
- [x] `src/lib/emi-calculator.ts` — `calculateEmi()` and `generateAmortization()` per PRD §9.2; final-payment residual absorption forces remainingBalance to 0.00; `addMonths()` uses UTC for timezone-stable due dates
- [x] `src/lib/emi-calculator.test.ts` — 14 vitest unit tests covering standard loan, 0% interest, single-month, rounding residual, principal sum reconciliation, end-of-month clamping, input validation errors; all pass

### Server layer
- [x] `src/server/emis.ts`: `listEmisFn`, `getEmiFn`, `createEmiFn` (interactive $transaction creating EMI + all payments), `deleteEmiFn` (profile-scoped deleteMany), `markPaymentPaidFn` (profile-scoped updateMany), `upcomingPaymentsFn` (next 5 non-paid within 30 days with isOverdue flag)
- [x] `serializeEmi()` + explicit `SerializedEmi` / `SerializedEmiPayment` interfaces so the hook layer sees strings, not Prisma Decimals
- [x] Zod schemas: `emiCreateSchema`, `emiListQuerySchema`, `emiIdSchema`, `markPaymentPaidSchema`, `EMI_TYPES` export

### Hooks
- [x] `src/hooks/useEmis.ts` — `useEmisQuery`, `useEmiQuery`, `useUpcomingPaymentsQuery`, `useCreateEmi`, `useDeleteEmi`, `useMarkPayment` with `onMutate` optimistic update + `onError` rollback + `onSettled` invalidation
- [x] Invalidates `["emis"]`, `["emis","detail",id]`, `["upcoming-payments"]`, `["dashboard-stats"]`

### UI
- [x] `src/routes/app/emis/index.tsx` — summary card, 3-pill filter (All / Bank Loan / Credit Card), EMI cards with color-coded badge, progress bar, next due date, remaining balance, FAB to /new
- [x] `src/routes/app/emis/new.tsx` — label + type toggle + principal/rate/tenure/start date, **live preview card** showing Monthly EMI / Total Payment / Total Interest that lights up when inputs become valid
- [x] `src/routes/app/emis/$emiId.tsx` — remaining-balance hero, 3-tile stats (Monthly / Principal paid / Interest paid), lazy-loaded donut chart, scrollable amortization schedule with paid checkboxes (optimistic), overdue highlight, confirmation-dialog delete
- [x] `src/components/PrincipalInterestDonut.tsx` — recharts donut lazy-imported by the detail page so it doesn't land in other route bundles
- [x] Overdue detection: `dueDate < now && status !== 'paid'` on the detail page and in `upcomingPaymentsFn`

### Primitive added
- [x] `src/components/ui/ProgressBar.tsx` — 4px thin track with `role="progressbar"` and aria-valuenow/min/max

### Verified end-to-end
- [x] 14/14 vitest unit tests pass
- [x] Direct Prisma + calculator smoke test: created user + profile, calculated ৳23,536.74 EMI for ৳500k @ 12% for 24mo, atomic transaction inserted 24 payment rows, sum of principal components = 500,000.00 exactly, last row remainingBalance = 0, mark-paid persisted, cross-profile delete rejected (count=0), correct-profile delete cascaded, upcoming query showed 0 after cleanup
- [x] Production build rendered `/app/emis` (filter pills, list, tab bar visible) and `/app/emis/new` (form sections, live preview label, tab bar hidden)
- [x] `npm run build`, `npx tsc --noEmit`, `npm run lint` all clean

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
- [x] Update `<title>` and meta tags in `__root.tsx` from "TanStack Start Starter" to "Phinio" (done in Phase 1)
