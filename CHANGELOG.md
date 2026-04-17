# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-17

Adds withdrawals across every investment type and corrects ROI math so
realized proceeds are counted exactly once.

### Added

- **Withdrawals** — record money flowing out of any investment without
  losing the original invested amount needed for ROI. Partial
  withdrawals on lump-sum and savings pots, premature closure on DPS
  schemes (with an optional bank-paid "received" amount that defaults to
  the latest accrued value). Full withdrawals automatically close the
  investment; partial withdrawals on scheduled DPS are not allowed, to
  avoid silently stranding a residual balance.
- **Shared Withdraw modal** opens from two entry points: a Withdraw link
  next to the Active/Completed tabs on the investments index (with a
  picker listing every active investment), or from the hero card on any
  investment detail page (pre-selected to that investment). The modal
  renders the correct form for the investment's mode — partial-withdraw
  for lump-sum and savings, premature-closure for DPS — and re-defaults
  the received amount when the user switches DPS schemes mid-modal.
- Seed script now includes three withdrawal scenarios (emergency-fund
  partial withdrawal, exited lump-sum closed via two tranches, DPS
  closed early after nine paid installments) so a fresh `db:seed` has
  visible data for the new flow.

### Changed

- The withdraw/close action now lives inside the hero balance card on
  every investment detail screen — DPS "Close prematurely", the
  savings-pot Deposit/Withdraw pair, and a new lump-sum hero card with
  current value + return % and an inline Withdraw button. Previously
  these actions were scattered below the page content.

### Fixed

- Completed investments closed via withdrawal no longer show inflated
  ROI. For withdrawal-closed items `exitValue` already equals total
  withdrawn, so the list view and investment card now use `exitValue`
  alone as the numerator instead of summing it with withdrawals — a
  break-even close (invest 10k, withdraw 10k) reads as 0% instead of
  +100%.
- Dashboard gain/loss % now folds realized withdrawals into the ROI
  numerator, so a partial withdrawal on an active investment no longer
  appears as a loss. Allocation totals still reflect only the money
  still held.

## [1.0.0] - 2026-04-17

Initial public release of Phinio — a mobile-first PWA for personal finance that
tracks investment portfolios and manages EMI (loan and credit-card)
amortization schedules.

### Added

- **Investments module** with full lifecycle: create, edit, and delete lump-sum
  investments across stocks, crypto, FD, gold, mutual funds, Sanchayapatra,
  real estate, agro farm, and business categories. Active/completed tabs, a
  type filter, per-asset return % math, and an edit flow that reveals exit
  value + completion date when an investment is marked complete.
- **DPS (Deposit Pension Scheme)** support with scheduled monthly deposits.
  Full installment schedule is generated up front (simple or compound
  interest), live maturity preview in the create form, overdue badges on the
  deposit schedule, and automatic maturation when every installment is marked
  paid.
- **Savings pots** (flexible-mode investments) with ad-hoc deposits, an
  auto-created "Initial deposit" row when the pot is opened with a non-zero
  balance, and server-side syncing of `currentValue` and `investedAmount` as
  deposits are added or removed.
- **EMI manager** with bank-loan and credit-card types. Bank loans use
  reducing-balance amortization; credit-card EMIs use flat-rate interest to
  match how Bangladeshi banks handle card conversions. List, detail, and
  create screens, a principal-vs-interest donut chart, optimistic mark-paid
  on the amortization row, and cascade-on-delete of payment rows.
- **Home dashboard** with a net-worth hero, quick stats (invested amount with
  gain/loss %, monthly EMI outflow), upcoming payments within 30 days, an
  allocation donut grouped by investment type, and a welcome CTA when the
  account is empty.
- **Persistent notifications** keyed by `(profileId, dedupeKey)` with
  idempotent inserts, a lazy `syncDerivedNotifications` pass that surfaces
  "payment due in ≤3 days" and "overdue" rows without a cron, plus a top-bar
  bell with unread-count badge, 5-minute background polling, mark-on-click,
  and mark-all-read.
- **Authentication** via Better Auth: email + password signup with strict
  email verification (Resend-backed), auto sign-in after verification, a
  dedicated check-email screen, password reset, and a change-password flow in
  the profile screen.
- **Profile screen** with profile-photo upload, inline name editing, BDT/USD
  currency toggle, sign-out confirmation, and a dynamically displayed app
  version.
- **Landing page** — a scrollable marketing site with hero, feature cards,
  how-it-works, animated SVG icons, drifting ambient orbs, and a floating
  logo cluster, publicly accessible at the root even when signed in.
- **Global app shell** — a shared TopBar (logo on tab pages, back arrow on
  sub-pages, dynamic titles via context), a bottom tab bar that hides on form
  pages, and a global FAB menu with Investment / DPS / Savings Pot / EMI
  creation actions.
- **PWA support** — installable manifest, Phinio-branded icon set
  (favicon variants, apple-touch-icon, maskable Android icons), matching
  nocturnal theme colors (no white flash on launch), and a Workbox service
  worker with SSR-safe runtime caching for bundles, images, and Google Fonts.
- **Branded transactional emails** — fully inline HTML templates for
  verification and password reset, matching the Modern Noir palette, with
  Outlook VML fallback for the CTA button and plain-text fallbacks.
- **Error handling and empty states** — global `errorComponent` and
  `notFoundComponent` with a back-to-home CTA, loading skeletons across list
  pages that mirror the final content shape, and sonner toasts on every
  mutation with optimistic rollback on error.
- **Reusable UI primitives** — `Card`, `EmptyState`, `FAB`, `FilterPills`,
  `TextField`, `TextArea`, `ProgressBar`, `Skeleton`, `Logo`, and a
  portal-based `ConfirmModal` for delete/sign-out confirmations.
- **Vercel integration** — automatic `prisma migrate deploy` on build,
  `@vercel/analytics`, and `@vercel/speed-insights` (LCP, CLS, INP) wired
  into the root document.
- **Seed script** (`npm run db:seed`) with realistic data covering all three
  investment modes plus EMIs.
- **Test suite** — 118 unit tests (validators, currency formatting,
  investment P/L math, EMI amortization) plus 40+ PGlite-backed integration
  tests covering every server impl against a real Postgres, with zero mocking
  of Prisma or Better Auth.

### Changed

- **Unified investment schema** — replaced the separate `Dps`/`DpsInstallment`
  tables with a single `Investment` + `InvestmentDeposit` model supporting
  `lump_sum`, `scheduled`, and `flexible` modes. Server-side totals are kept
  in sync so list and dashboard queries never join deposits.
- **Server architecture** — every server module is split into a thin
  `createServerFn` wrapper and a sibling `.impl.ts` holding the Prisma and
  Better Auth access. Impl functions dynamically imported from handler bodies
  keep Prisma, the pg adapter, and ~389 KB of Node-only code out of the
  client bundle, and make every handler directly testable.
- **Design system** — swapped the TanStack starter tokens for the Modern Noir
  nocturnal palette (surface hierarchy, primary/secondary/tertiary,
  outline-variant, Inter + Manrope), carved inputs, and glassmorphism. The
  app is dark-only with no theme toggle.
- **Documentation** — rewrote the README with Phinio-specific features, tech
  stack, getting-started guide, env reference, project structure, and
  deployment notes. Rewrote the PRD to v2.0 to match the shipped schema,
  screens, notification system, and PWA config.
- Notifications backend switched from `DpsInstallment` to the unified
  `InvestmentDeposit` model.
- Pinch-to-zoom restored on mobile (removed `user-scalable=no`).
- **Internal** — Prettier formatting pass across legacy config, docs, and
  mockup files; `.vercel` build output ignored in ESLint and git; ESLint dev
  dependency added; missing `@opentelemetry/api` peer dep for Better Auth
  added; `.npmrc` with `legacy-peer-deps=true` to unblock Vercel installs
  while `vite-plugin-pwa` catches up to Vite 8.

### Fixed

- Double input outline caused by a global `:focus-visible` rule.
- `noir-bg` clipping box shadows due to `overflow:hidden`; net-worth card
  shadow bleeding through rounded corners.
- Recharts `ResponsiveContainer` console warnings during initial layout
  measurement.
- Prisma datasource configuration for Vercel deploys — uses `DIRECT_URL`
  (non-pooled) in `prisma.config.ts` so `prisma migrate deploy` bypasses
  PgBouncer.
- Several pre-existing TypeScript errors that slipped past Vite builds,
  including a `forgetPassword` → `requestPasswordReset` rename to match
  Better Auth's current API.
- Timing-dependent flake in the upcoming-payments integration test.
- Invalid `fileParallelism` option removed from the Vitest project config.
