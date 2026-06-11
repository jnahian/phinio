# Phase 4 — Dashboard + Read Flows Implementation Plan

> **For agentic workers:** Each sub-phase (4A/4B/4C/4D) is a separately mergeable stacked PR. Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement each.

**Goal:** Every tab in the mobile shell renders real, profile-scoped data — dashboard tiles, investments list, EMI list, activity feed, and a notifications bell — all read-only. This validates the full tRPC + bearer-auth + MMKV-persister + glass pipeline on production-shaped data before any write flow ships.

**Source spec:** `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §7 item 4.
**Branch tree:** `feat/phase-4a-trpc-dashboard` → `feat/phase-4b-mobile-data-layer` → `feat/phase-4c-mobile-dashboard` → `feat/phase-4d-mobile-lists` (each stacks on the previous).
**Base for 4A:** `feat/phase-3d-mobile-auth` (tip of the Phase 1–3 stack, PRs #23–#34). Rebase to `main` once that stack lands.

**Known state going in:**

- All five `(app)` tab screens are 20-line placeholders rendering a centered title.
- `apps/mobile/src/hooks/` does not exist yet.
- The tRPC layer covers emis, investments, activity, notifications, profile, push — **but not dashboard**. Web's dashboard still runs on `createServerFn` (`apps/web/src/server/dashboard.{ts,impl.ts}`); mobile cannot call it. Porting it is 4A and is a hard prerequisite for the mobile dashboard.
- `@shopify/flash-list` is in the spec's library list but **not yet installed** in `apps/mobile`.
- `net-info.ts` reconnect handler is the single-tier invalidate-all version; per-profile prefetch was explicitly deferred to Phase 4.
- Mobile tRPC client (`src/lib/trpc.ts`) already mirrors web's provider-free `createTRPCOptionsProxy` style — mobile hooks can be near line-for-line ports of the web hooks' query halves.

---

## Phase 4A — Port dashboard domain to tRPC (web-side only)

**Goal:** `dashboard.stats` lives in `@phinio/trpc` next to the other six domains; the legacy server-fn wrapper is deleted; web behavior unchanged.

**Files:**

- `packages/trpc/src/routers/dashboard.ts` (new) — single `stats: protectedProcedure.query(...)` procedure. Line-for-line port of `getDashboardStatsImpl` with the mechanical substitutions used in every prior port (`profileId → ctx.profileId`, `prisma → ctx.prisma`). Export the `DashboardStats` and `UpcomingPaymentItem` types — the mobile dashboard consumes them in 4C.
- `packages/trpc/src/router.ts` — mount `dashboard` on `appRouter` (alphabetical order: activity, **dashboard**, emis, …).
- `apps/web/src/hooks/useDashboard.ts` — `dashboardQueryOptions()` becomes `makeTRPC(queryClient).dashboard.stats.queryOptions()`; `useDashboardQuery` follows.
- `apps/web/src/hooks/useEmis.ts`, `apps/web/src/hooks/useInvestments.ts` — these invalidate `dashboardKeys.stats` after mutations. Point the invalidations at the new tRPC query key (keep a `dashboardKeys`-style helper exported from `useDashboard.ts` so the call sites stay one-line).
- `apps/web/src/lib/prefetch-profile-data.ts` — dashboard prefetch entry switches to the tRPC options.
- `apps/web/src/routes/app/index.tsx` — loader prefetch switches to the tRPC options.
- **DELETE** `apps/web/src/server/dashboard.ts` + `apps/web/src/server/dashboard.impl.ts`. The local `requireProfileId` inside `dashboard.impl.ts` is self-contained (dev-data has its own copy) — safe to delete with the file.
- `apps/web/tests/integration/dashboard.test.ts` (new) — via `appRouter.createCaller(ctx)`, covering at minimum:
  - `profileId` scoping (another profile's investments/EMIs never leak into stats).
  - Net worth = Σ currentValue − Σ next-unpaid `remainingBalance` (not Σ remaining emiAmounts).
  - Withdrawals restore realized gains to `gainLossPercent` without inflating `current`/allocation.
  - Processing-fee sentinel rows (`paymentNumber = FEE_PAYMENT_NUMBER`) excluded from upcoming payments.
  - Upcoming payments: merged EMI + deposit rows, sorted by due date, capped at 5; same-day due is not overdue (UTC day comparison).

**Invariants:** wire format identical to the server-fn version (superjson handles the `Date` fields); read-only domain so no `clientMutationId` surface.

**Verification:** `pnpm --filter @phinio/trpc exec tsc --noEmit` · `pnpm test` (web suite + new dashboard tests green) · `pnpm lint` · `pnpm build:local` · manual: `/app` dashboard renders identically, mutations still refresh the tiles.

---

## Phase 4B — Mobile data layer (hooks, formatters, FlashList, reconnect prefetch)

**Goal:** Everything the screens need, with zero screen changes. End state: placeholders unchanged but `useDashboard()` etc. compile and fetch.

**Files (new unless noted):**

- `apps/mobile/package.json` (edit) — add `@shopify/flash-list` (Expo SDK 54-compatible release).
- `apps/mobile/src/lib/format.ts` — `formatCurrency` / `getCurrencySymbol` mirroring `apps/web/src/lib/currency.ts` (BDT ৳ / USD $, money stays string-typed end to end), plus a locale-aware date formatter matching web display conventions. Hermes ships full `Intl` on both platforms in RN 0.81 — no polyfill. *Note in PR: candidate for extraction to a shared package when Phase 5 needs the same logic for input parsing; copying ~60 lines now beats a premature package.*
- `apps/mobile/src/hooks/useDashboard.ts` — `useQuery(trpc.dashboard.stats.queryOptions())`.
- `apps/mobile/src/hooks/useInvestments.ts` — list query keyed by the same `{ status, type }` filter input as web.
- `apps/mobile/src/hooks/useEmis.ts` — list query (active/completed filter).
- `apps/mobile/src/hooks/useActivity.ts` — `useInfiniteQuery` with `{ limit: 15 }`, `initialCursor: null`, `getNextPageParam: (last) => last.nextCursor` — exact mirror of web's `useActivityLog`.
- `apps/mobile/src/hooks/useNotifications.ts` — `list` + `unreadCount` queries with the same 5-minute `refetchInterval` as web (cron-created notifications surface without manual refresh).
- `apps/mobile/src/hooks/useProfile.ts` — `profile.get` (supplies `currency` to `formatCurrency` and the display name for the dashboard greeting / settings).
- `apps/mobile/src/lib/prefetch-profile-data.ts` — mobile mirror of web's helper: dashboard stats, notifications list + unread count, first activity page, investments list (active), emis list (active). Same ≥-interval throttle so reconnect flaps don't spray requests. Skip the per-detail fan-out web does — mobile adds detail prefetch when detail screens stabilize in 4D.
- `apps/mobile/src/lib/net-info.ts` (edit) — reconnect handler grows the deferred second tier: `resumePausedMutations()` → `invalidateQueries()` → `prefetchProfileData(queryClient)` (only when a session token exists).
- `apps/mobile/src/lib/__tests__/format.test.ts` — vitest unit tests for the formatters (pure functions; the existing `react-native` stub pattern covers any RN import).

**Query-key parity note:** because mobile uses the same `createTRPCOptionsProxy`, query keys match web exactly, so the MMKV persister (same `v1` schema buster) restores into keys the hooks actually read. No manual key constants needed for queries.

**Verification:** `pnpm --filter @phinio/mobile exec tsc --noEmit` · `pnpm --filter @phinio/mobile test` · `pnpm lint` · `pnpm build:local` (expo export still bundles) · manual: dev client against LAN web server logs successful `dashboard.stats` batch call after login.

---

## Phase 4C — Dashboard screen + notifications bell

**Goal:** The Dashboard tab is real. Cross-reference three sources per repo convention: PRD dashboard section for behavior, `screens/home_dashboard/code.html` for layout, `screens/phinio_modern_noir/DESIGN.md` for tokens.

**Files:**

- `apps/mobile/app/(app)/index.tsx` (rewrite) — scrollable dashboard:
  - **Net worth hero** (`GlassCard`): `netWorth`, greeting from `profile.get`.
  - **Investment totals card**: invested vs current, gain/loss as `GlassPill` (`gain`/`loss` tone — secondary #4edea3 / tertiary-container #cf2c30, pills never background washes).
  - **Monthly EMI outflow card.**
  - **Allocation breakdown**: horizontal token-colored percent bars + labels inside one `GlassCard`. *Decision: no `react-native-svg`/donut at v1 — web's `AllocationDonut` stays web-only; bars convey the same data without a new native dep. Revisit if design review objects.*
  - **Upcoming payments** (≤5 rows from `dashboard.stats`): label, sequence number, amount, due-in-N-days, overdue tinted with loss tone. Rows flat; container is the glass surface.
  - Pull-to-refresh (`RefreshControl` → `refetch`), loading skeleton on first-ever load, cached-data-first render thereafter (persister), inline error state with retry.
- `apps/mobile/src/components/NotificationsBell.tsx` (new) — bell icon (SF Symbol / MaterialIcon, same per-platform pattern as `GlassTabBar`) with unread-count badge, mounted in a `GlassNav` on the dashboard.
- `apps/mobile/src/components/NotificationsSheet.tsx` (new) — `GlassSheet` listing notifications (read/unread visual state, relative timestamps). **Read-only:** mark-read/mark-all-read/clear are Phase 5 writes. Tab bar hides while the sheet is open (≤3 glass surfaces rule).
- i18n: reuse the existing `dashboard` and `notifications` namespaces from `@phinio/i18n-resources` — keys already exist for web; add mobile-only keys (if any) to both `en` and `bn`.

**Glass budget check:** tab bar + dashboard `GlassNav` + one content card scrolling = 3 active surfaces; the allocation/upcoming cards must share one glass container or use flat `surface-container-*` tokens for secondary cards — follow the mockup, keep ≤3.

**Verification:** type/lint/test/build gates as 4B · manual on iOS 26 device + Android emulator: tiles match the same profile's web dashboard numbers exactly; airplane-mode relaunch renders cached tiles; bell badge matches web.

---

## Phase 4D — Lists: investments, EMIs, activity + read-only detail screens

**Goal:** Remaining read surfaces. Lists virtualize with FlashList; "container is glass, rows are flat."

**Files:**

- `apps/mobile/app/(app)/investments/index.tsx` (rewrite) — FlashList of investments. Filter pills (active/closed × all/dps/savings/type) mirroring web's list filters, driving the same `{ status, type }` query input. Row: name, type chip, invested → current, gain/loss `GlassPill`; DPS rows show paid-count/tenure + next due. Mockup: `screens/investments_portfolio/code.html`.
- `apps/mobile/app/(app)/investments/[id].tsx` (new, read-only) — detail from `investments.get`: summary card, deposits schedule (status, due/paid dates, accrued value), withdrawals list. No FAB, no actions — those are Phase 5.
- `apps/mobile/app/(app)/emis/index.tsx` (rewrite) — FlashList of EMIs: label, type, EMI amount, progress (paid/total from list payload), next due date. Mockup: `screens/emi_overview/code.html`.
- `apps/mobile/app/(app)/emis/[id].tsx` (new, read-only) — detail from `emis.get`: breakdown card + full amortization schedule (paid/unpaid/overdue row states, fee row rendered distinctly). Mockup: `screens/emi_details_schedule/code.html`.
- `apps/mobile/app/(app)/activity.tsx` (rewrite) — infinite FlashList over `useActivity`; `onEndReached → fetchNextPage`, footer spinner while fetching, day-grouped headers if the mockup shows them.
- Shared row components as they emerge (`src/components/` — e.g. `MoneyText`, `ListRow`) — extract on second use, not speculatively.
- Settings tab stays a stub (its content is profile *mutations* — Phase 5).

**Empty states:** every list needs a designed empty state (first-run profile has no data) — copy from the i18n namespaces, flat surface, no CTA buttons yet (creates are Phase 5).

**Verification:** type/lint/test/build gates · manual matrix per spec §8: iOS 26 device (liquid), iOS <26 simulator (blur), mid-range Android (sustained-scroll perf on a 100+ row list — seeded via `pnpm db:seed`); scroll a long activity feed and confirm pagination; airplane-mode relaunch shows cached lists.

---

## Out of scope (Phase 5+)

- All mutations: create/edit/delete/mark-paid, notification mark-read/clear, settings changes.
- `apps/mobile/src/lib/mutation-defaults.ts` offline-replay registry (no mobile mutations exist yet).
- FAB radial menu actions (`GlassFAB` stays unmounted on list screens until creates exist).
- Push notifications, `PushSubscription.transport` migration, badge counts (Phase 6).
- Maestro E2E + RN Testing Library component harness — first Maestro flow lands with Phase 5's offline-replay loop, where E2E pays for itself.
- `packages/auth/` extraction and iOS `associatedDomains` (production-domain PR).

## Risks specific to Phase 4

- **FlashList v2 / Expo SDK 54 compatibility** — verify the pinned version renders inside `GlassSurface` parents on both platforms before building all four lists; fall back to `FlatList` per-screen if a blocker surfaces (interface is intentionally compatible).
- **Dashboard query-key migration on web (4A)** — `useEmis`/`useInvestments` invalidate dashboard stats after every mutation; a missed call site means stale tiles after writes. Grep for `dashboardKeys` is the review gate.
- **Hermes `Intl` currency rendering** — confirm `৳` renders correctly on Android Hermes early in 4B; if not, formatter falls back to symbol-prefix string concat (logic already isolated in `format.ts`).
- **Persister payload growth** — four list queries + dashboard + activity pages now persist to MMKV; verify restore time stays imperceptible on the Android test device (spec's cold-start gate from 3B still applies).
- **Stack depth** — this stacks on 9 unmerged PRs. Any rebase of #23–#34 ripples here; keep 4A–4D merges fast or land the base stack first.

## Self-review

- [ ] Does every screen read through a hook in `src/hooks/` (no inline `useTRPC` in screens)?
- [ ] Do mobile and web render identical numbers for the same profile (manual side-by-side)?
- [ ] Is every glass usage routed through the primitives (no raw `GlassView`/`BlurView` imports in screens)?
- [ ] Are money values still strings everywhere (no `Number()` arithmetic outside the ported dashboard math)?
- [ ] Do `en` and `bn` both have every new key?
