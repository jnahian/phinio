# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.5] - 2026-08-25

### Fixed

- Reopening the installed app no longer drops you on the landing page. A
  home-screen install always relaunches at one fixed address rather than
  wherever you left off, and that address pointed at the marketing page — so
  once the phone reclaimed the backgrounded app, anywhere from minutes to
  hours later, the next tap started you at the front door instead of your
  dashboard. It now opens straight into the app. You were never signed out;
  only the landing spot was wrong. Copies already installed keep the old
  address until the browser refreshes it in the background, so until then the
  landing page forwards you on if you are signed in.
- Opening the app with no connection now boots into your last-synced data
  instead of the landing page. The offline shell only ever covered the app
  itself, which is not where a relaunch was landing.

## [1.8.4] - 2026-08-18

Phinio now has a native iPhone app, backed by a new REST API. Almost
everything below is new surface area rather than a change to the web app —
the one exception is the EMI scheduling fix.

### Added

- **Phinio for iPhone** — a native app covering the whole product: sign-up
  with email verification, sign-in and password reset; a home dashboard with
  net worth, quick stats, an interactive allocation donut and upcoming
  payments; investments (lump-sum, savings pots and DPS) with detail screens,
  forms, deposits, withdrawals and premature close; EMIs with a live payment
  preview while you type and a full amortization schedule you can tick off;
  activity history; a notification centre with an unread badge; and a profile
  screen with photo upload, currency and language switching, and
  payment-reminder settings.
- **The iPhone app works offline.** Everything is held on the device, so the
  app opens and reads with no connection. Writes queue up and drain
  automatically once you are back online, with an offline banner while you
  are away and a sync-issues list for anything the server rejected.
- **Bengali throughout the iPhone app**, matching the web app's language
  support, with the language switch applying immediately.
- **Payment reminders on iPhone.** The reminder job now pushes EMI and DPS
  due-date notifications to registered devices, and tapping one opens the
  record it refers to. Push is dormant in this build — signing the APNs
  entitlement needs a paid Apple developer membership.
- **A REST API under `/api/v1`.** Bearer-token access to profile,
  investments, EMIs, notifications, dashboard, activity and device
  registration, plus a full-snapshot endpoint that seeds the app's offline
  database in a single request.

### Fixed

- New EMI schedules bill the first installment one calendar month after the
  start date instead of on the start date itself. Month-end starts still
  clamp, so a January 31 start falls due February 28. EMIs created before
  this release keep their original schedules.

## [1.8.3] - 2026-07-16

### Changed

- **The landing page has been redesigned.** A two-column hero with an
  interactive phone mockup and an animated allocation donut, an asset-class
  trust bar, feature cards with checklists, a numbered how-it-works walkthrough
  with sample cards, a new "A vault, not a feed" security section, and
  Features / Security / How-it-works anchor links in the nav. English and
  Bangla copy were restructured to match; the Bangla translations are new and
  worth a review pass.

### Fixed

- Closed Savings pots no longer read as ৳0.00. A card now shows the payout you
  actually realized at closure instead of its drained current value.
- Closed and matured DPS cards now show the amount actually received rather
  than the invested amount, and no longer display the maturity-value arrow —
  a premature closure typically pays less than maturity, and showing the
  forecast hid that.
- Closing an investment with a partial withdrawal is now rejected. Previously
  a request could mark an investment completed while it still held a positive
  balance, which broke return accounting.

## [1.8.2] - 2026-06-03

### Changed

- The new-investment form now autofills the current value from the invested
  amount as you type, so you no longer enter the same number twice for a fresh
  lump-sum position. The field stays editable — type your own value and it
  holds.
- Completing an investment now sets its current value to the exit value, so a
  realized position reads back the amount it was closed at.

## [1.8.1] - 2026-05-21

### Added

- **Estimated closure date for investments.** Investments now carry an
  optional estimated closure date that can be set when creating an
  investment, changed later from the edit screen, and is shown on the
  investments list.

## [1.8.0] - 2026-05-10

### Added

- **Overdue section on EMI, DPS, and Savings detail pages.** Unpaid
  past-due payments now surface in a dedicated section above the
  amortization or deposit schedule so late items are visible at a
  glance.
- **Upcoming DPS deposits on the Home dashboard.** Scheduled investment
  deposits appear alongside EMI payments in the Upcoming rail, sorted
  by due date, each linking to the relevant DPS or EMI detail page.

### Changed

- **Consolidated action menu on detail pages.** The inline edit pencil
  and bottom edit/complete/delete buttons on EMI, DPS, and Savings
  detail pages have been replaced by a single dropdown menu in the top
  right. Escape closes the menu and returns focus to the trigger.
- **Home layout** — the allocation chart now sits above the upcoming
  payments list.
- **EMI principal-vs-interest donut** is now placed beside its legend
  for a tighter layout.

### Fixed

- **Same-day due dates no longer flip to overdue at UTC midnight.** The
  Home upcoming list compares date-only due dates by day rather than
  timestamp, so items due today stay "due today" regardless of the
  user's wall-clock time relative to UTC.

## [1.7.0] - 2026-05-07

The headline change is **Bangla language support** — Phinio now ships a
fully bilingual UX with native Bengali numerals, the natural fit for its
BDT-default audience. Alongside that, offline/sync feedback moved out of
the page flow so saving no longer shifts the layout.

### Added

- **Bangla (বাংলা) language throughout the app.** Every user-visible
  screen — auth, dashboard, investments, EMIs, DPS, savings, activity,
  profile, notifications, withdraw flows, and the landing page — is
  translated. Currency, dates, percentages, counts, and relative times
  all render with native Bengali digits in Bangla mode (e.g.
  ৳১,২৩,৪৫৬.৭৮, ৬৮.২১%). Currency codes like BDT/USD stay verbatim as
  ISO codes.
- **Language switcher on the landing page.** Unauthenticated visitors
  can flip between English and Bangla from the landing nav before
  signing up; the choice persists via cookie. Authenticated users
  continue to set their preferred language from the profile page, which
  also saves it to their account.

### Changed

- **Offline and sync state now appear as toasts instead of a top
  banner.** The errored / offline / syncing indicators overlay the
  page rather than insert into document flow, so saving no longer
  pushes content down. The "Syncing…" toast is also debounced so fast
  online saves don't flash it.
- **PWA `start_url` is now `/app`.** Launching Phinio from the home
  screen drops you straight into the app shell instead of the landing
  page.
- Removed the background blur effect on landing page decorative
  elements.

### Fixed

- Currency, percentages, and relative time strings (e.g. "5 minutes
  ago", "99+" notification badge) that previously rendered with Latin
  digits in Bangla mode now correctly use Bengali digits across all
  browsers.
- Various delete/complete confirmation dialogs that briefly lost their
  entity name (e.g. "Delete X?") and installment counts after the
  initial translation pass now interpolate the name and count
  correctly.
- Edit/save no longer causes a brief layout shift, even when the sync
  indicator briefly appears.

## [1.6.2] - 2026-05-05

### Added

- **Clear read notifications.** A new "Clear read" action in the
  notification panel deletes notifications you've already read, leaving
  only unread items behind. Sits alongside "Mark all read" and only
  appears when there are read items to clear.

## [1.6.1] - 2026-05-05

### Added

- **EMI processing fees.** Capture an optional one-time processing fee
  when creating an EMI. The detail view shows it as a separate
  "Processing fee" line alongside a "Total cost" figure, and the fee is
  excluded from progress, remaining balance, and the principal-vs-interest
  donut so existing aggregations stay accurate.

### Fixed

- Dashboard stats, upcoming payments, and the activity feed now refresh
  immediately after editing an EMI or DPS — previously these views kept
  showing stale labels until their cache expired.
- Top and bottom navigation bars now match the mobile browser's theme
  color, eliminating the visible seam against the browser URL bar.

## [1.6.0] - 2026-04-29

Day-of payment reminders, notes on every loan and savings vehicle, and
a refreshed landing page.

### Added

- **Due-today reminder.** A dedicated notification fires on the actual
  due date for each EMI installment and DPS deposit, distinct from the
  earlier "due soon" advance reminder. Each payment now produces up to
  three notifications across its lifecycle — due soon (3–1 days out),
  due today, and overdue — with no duplicates.
- **Notes on EMIs.** Add a free-form note when creating an EMI (lender,
  account number, or any context). The note is editable later from the
  EMI detail screen along with the label.
- **Notes editing for DPS and savings.** The DPS and savings detail
  screens now expose a notes field in their edit panels. Existing notes
  are shown as a read-only section when not editing.

### Changed

- **Landing page.** Refreshed hero, features, "How it works", and
  final-CTA copy across the marketing page; sharper, more concrete
  language. Header and footer logos are now clickable and link to home
  with a focus ring for keyboard navigation.
- **Repository docs.** Moved `Phinio_PRD_v1.md`, `OFFLINE_PLAN.md`, and
  `TASKS.md` into `docs/`, added a deployment walkthrough at
  `docs/DEPLOYMENT.md`, an MIT `LICENSE`, and a `CONTRIBUTING.md` with
  the project's per-query authorization, money-handling, and
  offline-first contribution rules. Not visible inside the app.

## [1.5.0] - 2026-04-29

Phinio now works offline. Reads survive a reload without a network,
writes queue locally and replay automatically when you reconnect, and
new EMIs render their full amortization schedule the instant you tap
"Create" — even on a flight.

### Added

- **Offline reads.** Dashboards, investment lists, EMI schedules, and
  activity stay visible across reloads with no connection. Cached data
  is kept for up to seven days and falls back to in-memory cache if the
  browser blocks persistent storage (Safari Private Browsing, full
  disk).
- **Offline writes.** Tapping Add, Save, Delete, or Mark paid offline
  no longer fails — the change is queued locally and replays the moment
  the network returns. A top banner reads "You're offline. Changes will
  sync when you reconnect." while disconnected, and "Syncing N changes…"
  while the queue drains. Each queued change carries an idempotency
  token so a flaky reconnect cannot duplicate writes.
- **Offline EMI creation with full schedule.** Creating an EMI without
  a connection renders the entire payment schedule immediately. You can
  open the EMI's detail page and mark individual payments paid offline;
  every step queues and replays in order on reconnect.
- **Optimistic deletes.** Deleting an investment, DPS, savings pot, or
  EMI removes the row instantly — no waiting on a round-trip. If the
  eventual sync fails, the row is restored automatically.
- **"Edit overwritten" reconciliation.** When two devices edit the
  same investment, the loser now sees a "Your edit was overwritten by
  a newer change — refreshing the latest" toast and the latest server
  state, instead of silently clobbering the winner.
- **Offline app shell.** Cold-loading `/app` without a network now
  boots from a cached shell and hydrates from local storage instead of
  showing a connection error.

### Changed

- \*\*EMI remaining balance now reflects principal owed, not principal
  - remaining interest.\*\* The "Remaining" figure on EMI list rows and
    the dashboard's "Net worth" calculation previously summed every
    unpaid installment (which includes interest), over-stating the
    outstanding liability. Both now use the next-unpaid payment's
    principal-payoff figure.
- **Cross-account safety.** Signing out wipes the persisted offline
  cache, and signing in as a different user on the same device clears
  any stale data and queued writes from the previous session before
  resuming.

### Fixed

- Concurrent duplicate submissions of the same change (e.g. a
  double-tap on a slow Save) no longer error — the second attempt
  recognizes the first as already-applied and returns the same result.
- Withdrawal balance checks no longer rely on floating-point math, so
  exact-value withdrawals close the position correctly instead of
  leaving fractional residue.
- Filtered EMI lists no longer briefly show a newly-created EMI in
  the wrong tab while the offline queue is still pending.
- Backend errors during route guards no longer mask as "you're
  offline." A real 500 now surfaces as a route error; only genuine
  network failures fall back to the cached identity.

## [1.4.1] - 2026-04-28

### Changed

- **Tab navigation renders instantly.** Switching between dashboard,
  investments, EMIs, and activity no longer freezes on the previous screen
  while data loads — the new tab mounts immediately and its existing
  skeleton states cover the fetch. Cached tab data also stays fresh for
  five minutes within a session, so repeated taps don't re-fetch.

### Fixed

- **Failed fetches now show a retry, not endless skeletons.** If the
  dashboard, investments list, EMIs list, or activity log can't reach the
  server and has no cached data, you'll now see a "couldn't load" message
  with a Retry button instead of perpetual loading shimmer. When cached
  data is already on screen, a background-refetch failure leaves the
  existing data in place.

## [1.4.0] - 2026-04-22

Sharpens the numbers Phinio shows you for EMIs and DPS — what you owe, and
what you've earned, now reflect reality more directly. Plus a couple of
quality-of-life touches on the EMI detail page.

### Added

- **EMI detail — Total row.** The principal-vs-interest breakdown now shows
  a "Total" row beneath it so you can see the full lifetime cost
  (principal + all interest) at a glance.
- **EMI detail — selectable donut legend.** Tap the Principal or Interest
  pill to highlight just that segment of the donut; tap again to clear. Same
  interaction as the dashboard allocation donut.

### Changed

- **EMI "remaining balance" now reflects the full unpaid payoff.** The figure
  on EMI cards, the detail page's headline, and the dashboard's aggregate
  EMI balance now sum the `emiAmount` of every unpaid installment — i.e. the
  total principal + interest still owed over the remaining term. Previously
  it showed the schedule's running balance _after_ the next payment, which
  was effectively off by one installment's principal.
- **DPS "interest earned" now tracks what you've actually earned.** Instead
  of showing a fixed projection of total interest over the full tenure, the
  number grows as you pay each installment — computed as the accrued value
  at the last contiguously paid deposit, minus the principal you've put in.
  Deposits paid out of order don't contribute until the gap is filled.

## [1.3.1] - 2026-04-20

### Fixed

- Toast notifications no longer collide with the iOS status bar / Dynamic
  Island when the app is installed as a PWA — they now sit below the
  safe-area inset at the top of the screen.

## [1.3.0] - 2026-04-20

Adds a public changelog page, a refreshed landing page, a selectable allocation
legend on the dashboard, and a batch of UX polish — tap feedback on every
interactive surface, a proper change-password modal, and snappier tab navigation.

### Added

- **Public changelog** — a new `/changelog` page lists every release's notes
  with version, date, and categorized changes. Linked from the landing-page
  footer. Rendered from `CHANGELOG.md` at build time so new releases appear
  automatically without any extra dependencies.

### Changed

- **Landing page refreshed** — the hero now names DPS schemes, savings pots,
  EMI amortization, and push reminders. The features grid grows from four
  cards to six, covering unified portfolio, EMI amortization, net-worth
  dashboard, push reminders, activity history, and privacy. The "how it
  works" flow and footer copy are updated to match.
- **Dashboard allocation donut** has a selectable legend. Tap a type to
  highlight its slice on the donut and visually dim the others; dimmed rows
  stay tappable so you can switch focus directly between types. Tap the
  selected row again to clear.
- **Change password** opens as a dedicated modal instead of expanding inline
  on the profile screen, matching how the other confirmation dialogs work.
- **Sign out** row on the profile screen renders its icon and label in the
  alert red already used for destructive actions, so it reads clearly at a
  glance.
- **Tap feedback everywhere** — every button, link, nav item, bottom-tab
  pill, and form control now scales down subtly on press. The default mobile
  tap flash is replaced by this consistent squeeze animation. Respects
  `prefers-reduced-motion`.
- **Tab navigation feels instant** — the four primary tabs (dashboard,
  investments, EMIs, activity) now prefetch their default view on
  hover/touch, and back-navigation between screens hits the local cache
  instead of refetching. Mutations still refresh the relevant data.
- **Installed PWA bottom clearance** — every `/app/*` page now reserves extra
  space below the iOS home indicator, so the bottom tab bar and sticky
  submit bars sit above the gesture handle instead of behind it. No effect
  on desktop or browser-tab mobile.

## [1.2.3] - 2026-04-20

### Fixed

- **iOS Dynamic Island / notch overlap** — when Phinio is installed to
  the home screen on iPhone, the TopBar and landing-page nav no longer
  sit behind the Dynamic Island. `env(safe-area-inset-top)` padding
  pushes both below the cutout. No effect on desktop or non-PWA mobile.

## [1.2.2] - 2026-04-19

### Fixed

- **Service worker 404 in production** — `dist/sw.js` was being built by
  vite-plugin-pwa but never made it into `.vercel/output/static/`, so
  `/sw.js` returned 404 on the live site. No service worker ever
  activated, every `navigator.serviceWorker.ready` call hung silently,
  and the Payment reminders toggle would fire its success toast but the
  subscription never completed. A post-build step now copies the SW
  into Vercel's static output.
- **Activity log back button** — the activity log screen is reached
  from the profile menu but was missing the TopBar back arrow. Now
  navigates back to Profile.

## [1.2.1] - 2026-04-19

### Changed

- **Profile screen** reorganized into three labelled groups:
  _Preferences_ (currency, payment reminders), _Account_ (activity
  history, change password, sign out), and _Developer tools_ (load test
  data, clear all my data). Sign out now sits under Account as a row
  entry matching the rest of the group.

### Fixed

- **Payment reminders toggle** no longer gets stuck off after
  successfully enabling. A focus-event race between the in-flight
  subscribe call and the hook's periodic sync could overwrite
  `isSubscribed` back to false; the toggle now reflects the subscribed
  state immediately without needing a page reload.

## [1.2.0] - 2026-04-19

Adds a user-facing activity log and replaces in-app reminder polling with
real browser push notifications that arrive even when Phinio is closed.

### Added

- **Activity log** — a new `/app/activity` screen (reached from the
  profile menu) lists every user-initiated mutation across investments,
  deposits, withdrawals, EMIs, payments, and profile settings. Edit
  entries expand to show field-level before → after diffs. Money diffs
  record the currency in effect at write time, so historical entries
  always render with the currency the user was actually using. Infinite
  scroll loads 15 entries at a time as you scroll.
- **Browser push notifications** — due and overdue EMI installments and
  DPS deposits now arrive as real OS-level push notifications, delivered
  even when the app is closed. Enable from a toggle on the profile
  screen or an inline banner in the notification bell; the bell popover
  shows a clear "blocked" hint when permission has been denied. A
  scheduled job sends reminders once per day.
- **In-app test data** — the profile screen gains a "Test data" section
  with a Load dialog (per-category toggles for lump-sum, DPS, savings,
  EMIs, plus an optional "wipe first" switch) and a Clear-all-my-data
  action that wipes every investment, EMI, deposit, withdrawal, and
  notification for the signed-in profile while keeping the account
  itself intact.

### Changed

- **Activity tab moved** — removed from the bottom navigation (back to
  four tabs) and surfaced as a row on the profile screen.
- **Notification bell** is now a log of pushes that were actually sent,
  not a list synthesised on every open. Action notifications (EMI
  created, investment created, DPS created, withdrawal, DPS closed) no
  longer appear in the bell.
- **Unmarking a paid installment** on an auto-matured DPS now
  reactivates the scheme and records the reactivation in the activity
  log.

### Fixed

- **PWA install UI** — corrected manifest icon sizes, split combined
  `purpose: "maskable any"` icon entries per Chrome's recommendation,
  and added mobile and desktop screenshots so the richer install
  experience appears on both form factors.
- **No-op edits** no longer produce empty "Edited …" activity entries
  when nothing actually changed.
- **Assistive-tech announcements** on expandable activity cards now
  correctly report their state via `aria-expanded` and `aria-controls`.

### Security

- Every mutating query now scopes by `profileId` in its `where` clause,
  so a write cannot cross into another profile even if an id were
  somehow leaked.

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
