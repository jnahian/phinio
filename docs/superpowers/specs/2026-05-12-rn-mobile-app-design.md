# Phinio Native (iOS / Android) — Design

**Date:** 2026-05-12
**Status:** Approved, ready for implementation planning
**Scope:** A React Native (Expo) companion app for Phinio, sharing the existing Postgres database and business logic with the web/PWA. Full feature parity with the PWA at v1.

---

## 1. Goals & non-goals

### Goals
- Native iOS + Android apps that talk to the same Postgres backend as the existing Phinio PWA.
- Full feature parity at v1: investments (lump_sum / scheduled / flexible), EMIs, dashboard, activity log, notifications, settings.
- Pervasive **Liquid Glass** aesthetic on iOS 26+; translucent blur fallback on iOS < 26 and Android (Material-style).
- Offline-first parity with the PWA: cached reads, queued writes, mutation replay with server-side idempotency.
- Single source of truth for schema, validators, business math, and auth — shared between web and mobile.

### Non-goals (v1)
- Biometric unlock / app PIN.
- iPad / tablet layout (phone-only; iPad gets scaled phone layout).
- Third-party API consumers (the API stays internal).
- Replacing the PWA. The native app is a companion, not a replacement.

---

## 2. Repository: monorepo migration

Convert the current single-package repo to a **pnpm + Turborepo** workspace.

```
phinio/
├── apps/
│   ├── web/                          ← current TanStack Start PWA, moved here
│   └── mobile/                       ← new Expo app
├── packages/
│   ├── db/                           ← prisma/schema.prisma + generated client + migrations
│   ├── trpc/                         ← tRPC router + procedures (single source of business logic)
│   ├── validators/                   ← Zod schemas (moved from src/lib/validators.ts)
│   ├── calc/                         ← EMI + DPS calculators (pure, isomorphic)
│   ├── auth/                         ← Better Auth config, shared between web SSR + tRPC context
│   └── design-tokens/                ← Modern Noir tokens; CSS variables for web, JS object for mobile
├── package.json                      ← workspace root, turbo pipeline
├── pnpm-workspace.yaml
└── turbo.json
```

**Why these packages:** the four cross-cutting concerns that must stay in sync across clients — schema, validators, EMI math, auth — each become a package with one owner. `apps/web` and `apps/mobile` are thin shells (routes + components + hooks).

**Migration impact on the existing web app:** imports change (`#/lib/validators` → `@phinio/validators`, `#/lib/emi-calculator` → `@phinio/calc/emi`), Prisma client path moves, but no runtime behavior changes. Ships as a single PR with the web test suite green.

---

## 3. Backend: tRPC layer

Introduce `@phinio/trpc` as the single home of business logic. Web and mobile both consume it.

### Router structure

```
packages/trpc/src/
├── context.ts            ← builds ctx: { profileId, prisma, locale, clientMutationId }
├── trpc.ts               ← initTRPC, protectedProcedure middleware (Better Auth session check)
├── idempotency.ts        ← withIdempotency helper (moved from src/server/_idempotency.ts)
├── router.ts             ← appRouter = { investments, emis, deposits, activity, notifications, profile, push }
└── routers/
    ├── emis.ts           ← list, get, create, update, markPaid, close
    ├── investments.ts    ← list, get, create, update, close
    ├── deposits.ts       ← list, markPaid, addAdHoc (flexible mode)
    ├── activity.ts       ← list (paginated)
    ├── notifications.ts  ← list, markRead, markAllRead
    ├── profile.ts        ← get, update (currency, language)
    └── push.ts           ← subscribe, unsubscribe (transport discriminator)
```

### Adapters

- **Web** (`apps/web/src/routes/api/trpc/$.ts`): catch-all route calls `fetchRequestHandler` from `@trpc/server/adapters/fetch`. Resolves `ctx.profileId` from the Better Auth session cookie.
- **Mobile**: `@trpc/client` with `httpBatchLink` pointed at `https://phinio.app/api/trpc`. Resolves `ctx.profileId` from the `Authorization: Bearer <token>` header (Better Auth bearer plugin).

### Auth split

| Client | Token transport | Storage |
| ------ | ---------------- | ------- |
| Web (SSR + browser) | Better Auth session **cookie** (httpOnly) | Browser cookie jar |
| Mobile | Better Auth **bearer plugin** → token in `Authorization` header | `expo-secure-store` |

The tRPC middleware reads either source and emits the same `profileId` — procedures don't know which client called them.

### Idempotency

Every mutation procedure's input schema includes `clientMutationId: z.string().uuid().optional()`. The procedure body wraps with `withIdempotency`. The existing `ProcessedMutation` table powers replay for both clients with no schema change.

### Migration approach

tRPC is introduced **alongside** the existing `createServerFn()` wrappers. Domains are ported one at a time, starting with `emis` (smallest). Web hooks migrate one by one; old wrappers are deleted once each domain's last consumer moves. By the end of Phase 2, `src/server/*.ts` is empty and the only server entry point is the tRPC catch-all + the auth catch-all + the cron route.

---

## 4. Mobile app

### Stack

- **Expo SDK 54+**, **TypeScript**.
- **Expo Router** (file-based, mirrors the web app's mental model).
- **Dev client**, not Expo Go (MMKV + `expo-glass-effect` + `@better-auth/expo` all require native modules).
- **EAS Build** for iOS/Android signing and OTA updates.

### Layout

```
apps/mobile/
├── app/                              ← Expo Router routes
│   ├── _layout.tsx                   ← Root providers (tRPC, Query + persister, theme, i18n, auth)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── reset.tsx
│   ├── (app)/                        ← Authenticated group, redirects to /(auth)/login if no session
│   │   ├── _layout.tsx               ← Glass tab bar
│   │   ├── index.tsx                 ← Dashboard
│   │   ├── investments/
│   │   │   ├── index.tsx
│   │   │   ├── [id].tsx
│   │   │   └── new.tsx
│   │   ├── emis/
│   │   │   ├── index.tsx
│   │   │   ├── [id].tsx
│   │   │   └── new.tsx
│   │   ├── activity.tsx
│   │   └── settings.tsx
├── src/
│   ├── components/
│   │   └── glass/                    ← Glass primitives (see §5)
│   ├── hooks/                        ← useEmis, useInvestments, useDashboard, etc.
│   ├── lib/
│   │   ├── trpc.ts                   ← tRPC client + React Query integration
│   │   ├── auth.ts                   ← Better Auth Expo client + SecureStore
│   │   ├── persister.ts              ← TanStack Query MMKV persister
│   │   ├── mutation-defaults.ts      ← Mirrors web's mutation-defaults registry
│   │   ├── net-info.ts               ← NetInfo listener → resumePausedMutations
│   │   ├── i18n.ts                   ← i18next (en/bn), mirrors apps/web
│   │   └── glass-tier.ts             ← useGlassTier() — platform/version/a11y resolver
│   └── theme/                        ← Modern Noir tokens consumed from @phinio/design-tokens
└── app.config.ts                     ← Expo config (plugins, iOS Info.plist, Android manifest)
```

### Key library choices

| Library | Purpose |
| ------- | ------- |
| `@trpc/react-query` | tRPC + TanStack Query hooks |
| `react-native-mmkv` | Sync persister backend (fastest available) |
| `expo-secure-store` | Bearer token storage |
| `@better-auth/expo` | SecureStore-backed sessions, deep-link helpers |
| `expo-notifications` | APNs + FCM push |
| `expo-glass-effect` | iOS 26+ Liquid Glass primitives (`GlassView`, `GlassContainer`) |
| `expo-blur` | iOS < 26 + Android translucency fallback |
| `react-native-reanimated` | Sheet drags, glass surface motion |
| `react-native-gesture-handler` | Swipe actions, pull-to-refresh gestures |
| `@gorhom/bottom-sheet` | Modal sheets (wrapped by `GlassSheet`) |
| `@shopify/flash-list` | Virtualized lists |
| `@react-native-community/netinfo` | Online/offline detection |
| `expo-linking` | Deep-link routing for email-verify / reset |

---

## 5. Liquid Glass system

Glass usage is **pervasive**, so a tight primitives layer is mandatory — no screen reaches for `expo-glass-effect` or `BlurView` directly.

### Primitives (`apps/mobile/src/components/glass/`)

| Primitive | Purpose |
| --------- | ------- |
| `GlassSurface` | Base wrapper. Resolves to the right backing per platform/version. |
| `GlassCard` | `GlassSurface` + Modern Noir 16px corner radius + padding tokens. |
| `GlassNav` | Top bar. Safe-area aware, scroll-tint reactive. |
| `GlassTabBar` | Bottom tabs. SF Symbols on iOS, Material icons on Android. |
| `GlassSheet` | Bottom-sheet / modal. Wraps `@gorhom/bottom-sheet` with glass backdrop. |
| `GlassFAB` | Floating action button + radial menu (mirrors web's `FABMenu`). |
| `GlassPill` | Chips, money pills (gain/loss). |

### Tier resolution

`useGlassTier()` is the single decision point. Every primitive consumes it; no component checks `Platform.Version` directly.

| Tier | Condition | Implementation |
| ---- | --------- | -------------- |
| **Liquid Glass** | iOS ≥ 26 AND reduce-transparency off AND perf flag on | `expo-glass-effect` `GlassView` (`regular` / `clear` variants) |
| **Translucent blur** | iOS < 26 OR Android | `expo-blur` `BlurView` + tinted overlay |
| **Flat tonal** | Reduce-transparency on OR low-end device flag | Solid `surface-container-*` token |

### Tokens

Shared with web via `@phinio/design-tokens`:

- Web consumes a generated CSS file under `@theme` in `styles.css`.
- Mobile consumes a generated TypeScript object (`tokens.dark`).
- Source of truth is one JSON file in `packages/design-tokens/src/tokens.json`.

Surface hierarchy (unchanged from the existing Modern Noir doc): `surface` → `surface-container-low` → `surface-container-high` → `surface-container-highest`, with `surface-container-lowest` for recessed inputs. Gains use `secondary` (#4edea3); losses use `tertiary_container` (#cf2c30); money colors render as pills, never background washes.

### Layout rules

- **"Container is glass, rows are flat."** Lists virtualize via `FlashList`; the surrounding card is glass, individual rows are flat. This keeps GPU cost predictable on long lists.
- **≤ 3 active glass surfaces on screen.** Tab bar + top nav + at most one content card. Sheets count temporarily; tab bar is hidden when a sheet is presented.
- **No animated blur intensity.** `expo-glass-effect` is GPU-friendly when params are static; animating intensity costs disproportionately.

### Accessibility

- Respect `prefers-reduced-transparency` → falls through to flat tier.
- Respect `prefers-reduced-motion` → drop Reanimated entrance animations.
- Every glass primitive renders a **fallback fill color underneath the blur** using a `surface-container-low` token. Invisible when blur is active; visible (and contrast-correct) when accessibility forces flat. Text always sits over this fallback fill, never directly over `surface`.

---

## 6. Cross-cutting concerns

### 6.1 Auth flow (mobile)

1. Login screen calls `authClient.signIn.email({ email, password })` from `@better-auth/expo`.
2. Better Auth returns a bearer token. The Expo plugin writes it to **`expo-secure-store`**.
3. tRPC client's `httpBatchLink` adds `Authorization: Bearer <token>` via a `headers()` callback that reads from SecureStore.
4. Email verification + password reset: Better Auth emails contain deep links (`phinio://verify?token=…`); Expo Router handles the scheme via `expo-linking`.
5. Session expiry: tRPC error link catches `UNAUTHORIZED` and navigates to `/(auth)/login`, clearing the token.

`BETTER_AUTH_URL` in mobile env points at the production web origin (the deep-link host). Documented in `apps/mobile/.env.example`.

### 6.2 Offline-first

Mirrors the web app's model, with React Native-specific backings:

- `react-native-mmkv` backs a custom `Persister` for `persistQueryClient`.
- `gcTime: 24h`, persister `maxAge: 7d`, same `CACHE_SCHEMA_VERSION` buster as web (shared via `@phinio/trpc`).
- All mutations use `networkMode: 'offlineFirst'` and mint `clientMutationId` + entity UUID client-side.
- `apps/mobile/src/lib/mutation-defaults.ts` re-registers every offline mutation key on app boot so paused mutations rehydrate after a force-close.
- `NetInfo.addEventListener` replaces the web `online` event. On reconnect: `await persisterReady` → verify session → `resumePausedMutations()` → `invalidateQueries()` → `prefetchProfileData()`.

### 6.3 Push notifications

- `expo-notifications` registers the device and returns an `ExpoPushToken`.
- The existing `PushSubscription` table gains a `transport` discriminator: `web_push | expo`. (Existing rows backfill to `web_push`.) The `endpoint` column stores either the web-push endpoint URL or the Expo push token.
- The reminders cron (`apps/web/src/routes/api/cron/send-reminders.ts`) branches on `transport`:
  - `web_push` → existing `web-push` dispatch flow.
  - `expo` → POST batch to `https://exp.host/--/api/v2/push/send`.
- `Notification` rows are inserted once per `dedupeKey` regardless of transport (existing unique constraint enforces this).
- Locale resolution unchanged — already keyed on `Profile.preferredLanguage`.
- iOS badge count: number of unread `Notification` rows for the profile. Updated on push receipt + app foreground.

### 6.4 i18n

Mobile mirrors the web app's i18n architecture:

- `i18next` + `react-i18next`, resources from `@phinio/i18n-resources` (extracted from `apps/web/src/lib/i18n/resources/`).
- Locale resolution: `Profile.preferredLanguage` from server on first sync; cached locally; user-changeable from Settings.
- Currency/date formatters keyed by locale, matching web behavior.

---

## 7. Delivery phases

Six sequential phases. Each is a separately mergeable chunk; full design lands across all six.

1. **Monorepo migration.** Convert root to pnpm + Turborepo. Move web into `apps/web/`. Extract `packages/{db, validators, calc, design-tokens, auth}`. Zero behavior change; web's full test suite stays green.
2. **tRPC layer.** Introduce `packages/trpc`. Wire `apps/web/src/routes/api/trpc/$.ts`. Port `emis` domain as the pilot, then `investments`, `deposits`, `activity`, `notifications`, `profile`, `push`. Web hooks migrate one by one; old `createServerFn` wrappers deleted as each domain ports.
3. **Mobile shell.** Scaffold `apps/mobile/` with Expo Router. Wire providers (tRPC, Query + persister, theme, i18n, Better Auth). Build glass primitives library. Implement `(auth)` group: login, signup, reset. End state: blank authenticated tab shell renders with Liquid Glass chrome.
4. **Dashboard + read flows.** Investments list, EMI list, dashboard tiles, activity feed, notifications bell. All read-only. Validates tRPC + persister + glass on real data.
5. **Write flows.** Create / edit / mark-paid for both domains. Activates offline mutation replay, idempotency, `clientMutationId`. Includes EMI schedule pre-generation via shared `@phinio/calc`.
6. **Push notifications.** `expo-notifications` registration. Schema migration: `transport` column on `PushSubscription`. Cron transport-branching. Badge counts. Last because it depends on real users and real APNs/FCM keys.

---

## 8. Testing strategy

- **`packages/calc`:** existing Vitest unit tests stay (pure functions, isomorphic).
- **`packages/trpc`:** Vitest with a Postgres test container. One test per procedure asserting (a) `profileId` scoping is enforced and (b) `clientMutationId` replay returns identical results.
- **`apps/web`:** existing test suite stays green throughout the migration. A regression caught here gates the monorepo PR.
- **`apps/mobile`:**
  - **Maestro** for end-to-end flows: login → create EMI → mark paid offline → reconnect → row persists; switch language → push payload renders in new locale.
  - **React Native Testing Library** for component-level tests: glass tier resolution (mocked platform/version/a11y), reduced-transparency fallthrough, optimistic cache patches.
- **Manual device matrix:** iOS 26 device for Liquid Glass; iOS < 26 device for blur fallback; mid-range Android (Pixel 6a or similar) for sustained-blur perf.

---

## 9. Risks

- **TanStack Start + tRPC coexistence** is uncommon. The catch-all route adapter is straightforward, but Nitro-on-Vercel can have edge cases. Mitigation: the pilot `emis` domain ships and runs in production before any mobile work starts.
- **`expo-glass-effect` is a young API** (Expo SDK 54 / iOS 26 era). Breaking changes are likely. Mitigation: all glass usage funnels through the primitives layer — one patch point.
- **MMKV + EAS Build first-time setup** can be fiddly. Budget a day for dev-client and provisioning setup.
- **`PushSubscription.transport` migration** must backfill existing rows to `'web_push'` before the cron's branch logic ships. Mitigation: data migration in the same PR as the schema change; deploy schema → backfill → code in that order.

---

## 10. Decisions log

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| App scope | Companion to PWA, shared Postgres | User answer; lowest risk to existing product |
| v1 scope | Full feature parity | User answer |
| RN framework | Expo (managed + dev client) | First-class Liquid Glass support; EAS handles signing |
| API strategy | tRPC layer (web + mobile share) | Single source of business logic across clients |
| Offline | Full offline-first parity | User answer; consistent UX with PWA |
| Glass scope | Pervasive on iOS, blur fallback on Android | User answer |
| Android visuals | Material-style blur fallback | Coherent without forcing brittle glass shaders |
| Repo layout | Monorepo (pnpm + Turborepo) | Single source of truth for schema, validators, calc, auth |
| Biometric / PIN | Punted to v2 | User answer |
| iPad layout | Punted to v2 | Phone-only first |
