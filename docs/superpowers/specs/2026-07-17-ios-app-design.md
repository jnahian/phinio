# Phinio Native iOS App — Design

**Date:** 2026-07-17
**Status:** Approved

## Summary

A native Swift/SwiftUI iOS app with full feature parity with the Phinio web app: dashboard, investments (savings + DPS with deposits/withdrawals), EMIs with amortization and payment marking, activity log, notifications, and profile. Offline-first with full offline writes. Distributed via TestFlight now, App Store later (review-compliance work deferred until submission).

## Decisions

| Decision | Choice |
| --- | --- |
| Stack | Swift 6 + SwiftUI, no third-party dependencies |
| Target | iPhone-only, iOS 26+, built with Xcode 26 SDK (Liquid Glass) |
| Scope | Full parity with web app |
| API | New REST layer (`/api/v1/*`) in the existing TanStack Start app |
| Auth | Existing Better Auth email/password + `bearer` plugin; token in Keychain |
| Offline | Full offline writes — SwiftData is the app's source of truth, mutation outbox, last-write-wins |
| Sync pull | Full-snapshot pull (no delta sync, no tombstones) |
| Push | Native APNs in v1, extending the existing reminder cron |
| Design | Fully native look — system light+dark, SF Symbols, stock controls, Liquid Glass |
| Repo | `apps/ios/` in this repo; delete abandoned `apps/mobile`, `apps/web`, and empty `packages/` husks |

## 1. Backend: REST API + auth

New file routes under `src/routes/api/v1/`, each a thin JSON wrapper around the existing `.impl.ts` functions — no business logic rewritten. ~25 endpoints mapping 1:1 to the existing server functions:

- **Profile:** `GET /api/v1/profile`, `PATCH /api/v1/profile` (name, currency, language)
- **EMIs:** `GET /api/v1/emis`, `GET /api/v1/emis/:id`, `POST /api/v1/emis`, `PATCH /api/v1/emis/:id`, `DELETE /api/v1/emis/:id`, `POST /api/v1/emis/:id/payments/:paymentId/mark-paid`, `POST /api/v1/emis/:id/complete`, `GET /api/v1/emis/upcoming`
- **Investments:** `GET /api/v1/investments`, `GET /api/v1/investments/:id`, generic create/update/delete, plus type-specific routes: savings (create, update, add-deposit, remove-deposit, withdraw, delete) and DPS (create, update, mark-deposit-paid, close)
- **Dashboard:** `GET /api/v1/dashboard`
- **Activity:** `GET /api/v1/activity`
- **Notifications:** list, unread-count, mark-read, mark-all-read, clear-read
- **Device tokens:** `POST /api/v1/device-tokens` (upsert on token), `DELETE /api/v1/device-tokens/:token`
- **Sync:** `GET /api/v1/sync/snapshot`

Web-push endpoints (`savePushSubscriptionFn` etc.) stay web-only. Dev-data endpoints are not exposed.

**Wire conventions:**

- Money as JSON strings, never numbers (Decimal rule).
- Dates as ISO 8601.
- Errors as `{ "error": { "code": string, "message": string } }` with correct HTTP status codes.
- Every route derives `profileId` from the Better Auth session and scopes every query by it — per-query authorization, same as the server functions today. Missing/invalid bearer → 401; another profile's resource → 404.

**Auth:** add Better Auth's `bearer` plugin to `src/lib/auth.ts`. iOS signs in against the existing `/api/auth/sign-in/email`, reads the token from the `set-auth-token` response header, stores it in the Keychain, sends `Authorization: Bearer <token>` on every request.

**Sync support:**

1. `GET /api/v1/sync/snapshot` returns the profile's entire dataset in one response: profile, investments with deposits and withdrawals, EMIs with payments, notifications. At personal scale this is a few hundred rows. Full-snapshot pull means no tombstones, no cursors, and deletes come for free.
2. Every mutation endpoint accepts an `Idempotency-Key` header (client-minted mutation UUID) wired into the existing `ProcessedMutation` dedupe, so the iOS outbox can retry safely.

## 2. iOS app: architecture & sync engine

**Project:** `apps/ios/Phinio.xcodeproj`. Dependencies: none — URLSession, SwiftData, Keychain Services, UserNotifications, BackgroundTasks.

**Layers:**

```
SwiftUI views
  → @Query / @Observable view models (read SwiftData directly)
    → Store (single write API: applies change to SwiftData + appends outbox row)
      → SyncEngine (background actor: drains outbox, pulls snapshots)
        → APIClient (URLSession + bearer token from Keychain)
```

**SwiftData models:** `Profile`, `Investment`, `InvestmentDeposit`, `InvestmentWithdrawal`, `Emi`, `EmiPayment`, `Notification` — mirroring the Prisma domain models — plus one app-only model:

- `PendingMutation`: `id: UUID` (doubles as the Idempotency-Key), `endpoint: String`, `payload: Data` (JSON), `createdAt: Date`, `attemptCount: Int`.

Money fields are Swift `Decimal`, encoded/decoded as strings on the wire.

**Write path (the only write path):** a user action calls the Store, which (1) applies the change to SwiftData immediately — UI updates via `@Query` — and (2) appends a `PendingMutation`. All entity IDs are client-minted UUIDs (the Prisma schema uses `@default(uuid())` everywhere), so there is no temp-ID reconciliation.

**EMI creation offline:** a Swift port of `src/lib/emi-calculator.ts` (formulas per PRD §9.2) generates all `EmiPayment` rows locally, exactly like the server does. The server regenerates authoritatively when the create mutation syncs; the next snapshot reconciles any drift.

**SyncEngine (single actor):** triggered on app foreground, after any outbox append when online, and via `BGAppRefreshTask`. Cycle:

1. Drain outbox FIFO. Each mutation POSTs with its UUID as `Idempotency-Key`.
   - Success → remove the row.
   - Network failure / 5xx → stop the drain; retry next cycle.
   - 4xx (validation or conflict rejection) → remove the row, record it to a "sync issues" list surfaced in Settings, continue draining.
2. Only when the outbox is empty: `GET /sync/snapshot` and replace local state wholesale. Snapshot apply is skipped while any outbox rows remain, so unsynced local writes are never clobbered.

Conflict resolution is last-write-wins by `updatedAt` on the server, matching `docs/OFFLINE_PLAN.md`.

**Auth state:** bearer token in Keychain. A 401 on any request flips the app to the login screen. Local data is wiped on explicit logout only (device token also deleted server-side on logout).

## 3. Screens

Tab bar (four tabs), `NavigationStack` per tab, stock SwiftUI controls, system light+dark, SF Symbols. Built with the iOS 26 SDK so stock chrome (tab bar, nav bars, sheets, toolbars) adopts Liquid Glass automatically; `.glassEffect()` / `GlassEffectContainer` used only for custom chrome (dashboard stat cards, EMI schedule-preview overlay).

1. **Dashboard** — net-worth/stat cards, upcoming payments list (`getDashboardStatsFn` + `upcomingPaymentsFn` equivalents). Small syncing/offline indicator. Gear → Settings.
2. **Investments** — list grouped by type. Savings detail: deposits, withdrawals, partial-close guard. DPS detail: installment schedule, mark deposit paid, close. Create/edit as sheets. Swipe actions for quick mark-paid/delete.
3. **EMIs** — list with progress; detail with full amortization table, mark payment paid, complete early; create form with native pickers and a live schedule preview from the Swift calculator.
4. **Activity** — activity log; bell in the nav bar for notifications (list, unread badge, mark read, mark all read, clear read).

**Settings** (from Dashboard gear): profile name/currency/language, notification toggle (+ re-prime if previously declined), sync status + sync-issues list, logout.

Forms use native `Form`/sheets with validation rules ported from `src/lib/validators.ts` (required fields, positive amounts, date bounds). Currency formatting via `Decimal.FormatStyle.Currency` with the profile currency. Localization via iOS String Catalogs seeded from the web app's i18n strings, same languages.

**Not in v1:** marketing/changelog pages, dev-data seeding, web-push management, theme choice, iPad layout, XCUITest suite, App Store review compliance (privacy policy, account deletion flow — deferred to submission).

## 4. Notifications (APNs)

**Server:**

- New Prisma model `DeviceToken` (`id`, `profileId`, `token @unique`, `platform`, `createdAt`, `updatedAt`) — separate from web-push `PushSubscription`.
- `POST /api/v1/device-tokens` upserts on token; `DELETE /api/v1/device-tokens/:token` on logout.
- The reminder cron (`src/routes/api/cron/send-reminders.ts`) gains an APNs branch: alongside web push, send each due reminder to the profile's device tokens via APNs HTTP/2 using a `.p8` token key. Env vars: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, plus bundle ID. Implemented as a small `src/server/apns.ts` (JWT signing + fetch), no SDK. A 410/`Unregistered` response deletes the token row.

**iOS:**

- Permission requested via the onboarding priming screen (after first login), then APNs registration and token POST.
- Tapping a reminder deep-links to the relevant EMI detail screen.
- Payloads set the app badge to the unread notification count.

**Known limitation (accepted):** reminders depend on the server cron; if the cron misses, no reminder. Same property as web push today.

## 5. Onboarding (first launch)

Shown once, tracked by a `UserDefaults` flag:

1. **Welcome** — 2–3 swipeable pages (track investments, manage EMIs, works offline). Stock `TabView` page style.
2. **Sign in / Create account** — against existing Better Auth endpoints. Signup keeps email verification: "check your email" screen with a re-check button that retries sign-in until verified.
3. **Notification priming** — context screen before the system permission dialog ("Enable reminders" / "Maybe later"). Re-reachable from Settings if declined.
4. **Initial sync** — snapshot pull with progress state, then Dashboard. New accounts land on empty states pointing at "Add your first investment / EMI".

Every step skippable except auth.

## 6. Error handling & testing

**Error handling:** reads never fail (local); writes never fail at the UI (local + outbox). Remaining surface: transient sync failures are silent (retry next cycle); server-rejected mutations (4xx) appear in Settings' sync-issues list; syncing/offline indicator on Dashboard; 401 → login screen.

**Testing:**

- **Swift EMI calculator + validators:** unit tests asserting against fixture outputs generated from the TypeScript implementation — same inputs must produce identical schedules to the paisa. Fixtures are generated by a small script in the web repo and checked in.
- **SyncEngine:** unit tests with a mock APIClient — outbox FIFO order, Idempotency-Key reuse across retries, 4xx-removes/5xx-retains, snapshot skipped while outbox non-empty, no clobbering of unsynced writes.
- **REST layer:** Vitest integration tests alongside existing server tests — 401 without bearer, 404 across profiles, idempotency replay, money-as-string serialization.
- **UI:** manual TestFlight passes; no XCUITest in v1.

## 7. Cleanup

Delete the abandoned, untracked `apps/mobile` (Expo scaffold), `apps/web`, and the empty `packages/` husks (`calc`, `db`, `trpc`, `validators`, `i18n-resources`, `design-tokens`) as part of this work. `.playwright-mcp/` is unrelated and left alone.

## Build order (high level)

1. Backend: bearer plugin, `DeviceToken` model, REST routes + idempotency, snapshot endpoint, APNs branch in cron. Testable independently via Vitest + curl.
2. iOS foundation: Xcode project, SwiftData models, APIClient, auth + Keychain, onboarding shell.
3. Sync engine + Store, EMI calculator port with fixture tests.
4. Screens: Dashboard → Investments → EMIs → Activity/Notifications → Settings.
5. APNs registration + deep links; TestFlight build.
