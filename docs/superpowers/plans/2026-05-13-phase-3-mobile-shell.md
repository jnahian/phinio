# Phase 3 — Mobile Shell Implementation Plan

> **For agentic workers:** Each sub-phase (3A/3B/3C/3D) is a separately mergeable stacked PR. Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement each.

**Goal:** Scaffold `apps/mobile/` as an Expo Router app with all providers wired, a glass primitives library, and a working auth flow. End state: launching on iOS 26 dev client + Android emulator opens login → authenticated empty tab shell with Liquid Glass chrome.

**Source spec:** `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §4-§6.
**Branch tree:** `feat/phase-3a-mobile-scaffold` → `feat/phase-3b-mobile-providers` → `feat/phase-3c-mobile-glass` → `feat/phase-3d-mobile-auth` (each stacks on the previous).
**Base for 3A:** `feat/phase-2def-trpc-domains` (provides AppRouter + validators + design-tokens). Rebase to main once Phase 2 lands.

**Confirmed prerequisites (user-supplied):**
- Apple Developer account active.
- iOS 26 device available for dev client (real or paid Xcode beta simulator).
- Dev origin for Better Auth: local LAN IP (`http://<mac-LAN-IP>:3000`).
- PR shape: stacked sub-PRs (4 total).

---

## Phase 3A — Scaffold

**Goal:** Workspace-integrated `apps/mobile/` Expo project boots a hello-world screen on iOS 26 dev client + Android emulator. No domain code, no glass, no auth — just the skeleton.

**Files (new):**
- `apps/mobile/package.json` — `@phinio/mobile`, workspace dependencies on `@phinio/trpc`, `@phinio/validators`, `@phinio/calc`, `@phinio/design-tokens`.
- `apps/mobile/app.config.ts` — Expo config with dev-client + iOS 26 deployment target + Android SDK 34. Bundle ID + package name placeholders.
- `apps/mobile/tsconfig.json` — extends `tsconfig.base.json`, paths alias `#/*` → `./src/*`.
- `apps/mobile/babel.config.js` — `babel-preset-expo`.
- `apps/mobile/metro.config.js` — workspace-aware Metro config (resolve `nodeModulesPaths` for monorepo, watch shared packages).
- `apps/mobile/app/_layout.tsx` — root layout with `<Stack />` and a single screen.
- `apps/mobile/app/index.tsx` — `<View>Hello Phinio Mobile</View>`.
- `apps/mobile/eas.json` — EAS Build profiles (`development`, `preview`, `production`).
- `apps/mobile/.env.example` — `BETTER_AUTH_URL=http://<mac-lan-ip>:3000`.
- `apps/mobile/README.md` — bootstrap instructions (one-time `eas login`, dev client install).
- `apps/mobile/.gitignore` — Expo + EAS ignores.

**Tasks:**

### Task 1: Create app with Expo template
- Run `pnpm dlx create-expo-app@latest apps/mobile -t with-router --no-install` (or the closest current template name; verify with `pnpm dlx create-expo-app@latest --help`).
- Replace the generated `package.json` with workspace-style: bump deps to match the chosen Expo SDK (54+), strip examples, add workspace `dependencies`. Set `"name": "@phinio/mobile"`, `"private": true`.

### Task 2: Workspace integration
- Edit root `pnpm-workspace.yaml` if `apps/*` glob doesn't already cover this (it should).
- Verify `turbo.json` pipelines treat `apps/mobile` like apps (no separate config needed unless Metro is special).
- `pnpm install` at root; verify `apps/mobile/node_modules` populates with hoisted deps.
- Configure Metro for monorepo (the `metro.config.js` file above) — without this, Metro fails to resolve `@phinio/*` packages.

### Task 3: tsconfig + types
- `apps/mobile/tsconfig.json` extends `tsconfig.base.json`. Add `"jsx": "react-jsx"`, `"types": ["expo", "react-native"]`. Path alias `#/*` → `./src/*`.
- `pnpm --filter @phinio/mobile exec tsc --noEmit` should pass with zero errors.

### Task 4: Hello-world screen + run scripts
- `apps/mobile/app/_layout.tsx`: minimal `<Stack screenOptions={{ headerShown: false }} />`.
- `apps/mobile/app/index.tsx`: View with text "Phinio Mobile — Phase 3A".
- `apps/mobile/package.json` scripts:
  - `dev` → `expo start --dev-client`
  - `dev:ios` → `expo run:ios --device`
  - `dev:android` → `expo run:android`
  - `build` → `expo export` (so workspace `pnpm build` doesn't trip)
  - `build:local` → same as `build` (matches the rest of the workspace convention)
  - `lint` → `expo lint`
  - `test` → `echo "no tests yet" && exit 0`

### Task 5: EAS configuration
- `apps/mobile/eas.json`:
  ```jsonc
  {
    "cli": { "version": ">= 12.0.0" },
    "build": {
      "development": { "developmentClient": true, "distribution": "internal", "ios": { "simulator": true } },
      "preview": { "distribution": "internal" },
      "production": {}
    }
  }
  ```
- Do NOT run `eas build` in this task — that's a manual step the user performs once with their Apple credentials.

### Task 6: Verification gates
- `pnpm install` at root succeeds.
- `pnpm --filter @phinio/mobile exec tsc --noEmit` → zero errors.
- `pnpm test` at root → 346 passing (web 340 + 6 packages); `@phinio/mobile`'s test script is a no-op pass.
- `pnpm lint` at root → clean.
- `pnpm build:local` at root → succeeds (mobile build outputs static export to `apps/mobile/dist/`).

**Manual gate (not blocking the PR):** user runs `pnpm --filter @phinio/mobile dev` and connects an iOS 26 device + Android emulator. "Phinio Mobile — Phase 3A" renders. If it fails to load, that's a 3A defect; if it loads, 3A ships.

**Commit message:**
```
feat(mobile): scaffold apps/mobile with Expo Router (Phase 3A)
```

---

## Phase 3B — Providers + tokens + i18n

**Goal:** App renders a static screen that pulls Modern Noir tokens from `@phinio/design-tokens`, translates strings via i18next using shared resources, has tRPC + Query + MMKV persister wired (no procedures called yet), and NetInfo observes online/offline.

**Files (new + modified):**
- New: `apps/mobile/src/lib/trpc.ts` — tRPC React Query client (`createTRPCReact<AppRouter>()`, `httpBatchLink` to `<BETTER_AUTH_URL>/api/trpc`, headers callback that will later read SecureStore but stubbed in 3B).
- New: `apps/mobile/src/lib/persister.ts` — MMKV-backed sync persister.
- New: `apps/mobile/src/lib/i18n.ts` — i18next init with `@phinio/i18n-resources`. (Plan side note: this package may not exist yet — if `apps/web/src/lib/i18n/resources/` is the current location, extract to a new workspace package `packages/i18n-resources` as a sub-task of 3B.)
- New: `apps/mobile/src/lib/net-info.ts` — NetInfo listener; on reconnect calls `queryClient.resumePausedMutations()`.
- New: `apps/mobile/src/theme/tokens.ts` — consumes `@phinio/design-tokens` and re-exports as a typed object usable by RN `StyleSheet`.
- New: `apps/mobile/src/theme/Themed.tsx` — small hook `useTheme()` returning the dark Modern Noir palette.
- Modified: `apps/mobile/app/_layout.tsx` — providers wrapping order: `QueryClientProvider` → `trpc.Provider` → `I18nextProvider` → `<Stack />`. Initialize the persister before rendering children.
- Modified: `apps/mobile/app/index.tsx` — display a translated string and a token-styled rectangle.
- Possibly new: `packages/i18n-resources/` workspace package if extraction is in scope.

**Dependencies to add to `apps/mobile/package.json`:**
- `@tanstack/react-query`, `@tanstack/query-async-storage-persister` (or use the sync variant with MMKV)
- `@trpc/client`, `@trpc/react-query`, `@trpc/server` (for AppRouter type only — already brought in via `@phinio/trpc`)
- `react-native-mmkv`
- `@react-native-community/netinfo`
- `i18next`, `react-i18next`
- `superjson`
- `react-native-svg` (utility; may be needed by primitives)

**Tasks:**

1. Add deps; `pnpm install`; verify Metro resolves them.
2. Create `lib/trpc.ts` — Provider + hooks (`createTRPCReact<AppRouter>` from `@trpc/react-query`). Use Provider-based integration since the mobile spec lists `@trpc/react-query` (different from web's `@trpc/tanstack-react-query` Provider-free integration). Header callback returns `{ 'x-locale': i18n.language }` initially; auth header added in 3D.
3. Create `lib/persister.ts` — MMKV instance + `Persister` interface implementation. `key: 'phinio-mobile-cache-v1'`.
4. Wire `persistQueryClient({ queryClient, persister, maxAge: 7d, buster: 'v1' })` in `_layout.tsx`. Block render until restore promise resolves (splash screen).
5. Create `theme/tokens.ts` consuming `@phinio/design-tokens` (read what shape it exports — likely a JSON object).
6. If `@phinio/i18n-resources` doesn't exist: create `packages/i18n-resources/` extracting `apps/web/src/lib/i18n/resources/`. Update `apps/web` to import from the new package. Otherwise: just import.
7. `lib/i18n.ts` — init i18next; default locale `en`; resources from the shared package.
8. `lib/net-info.ts` — NetInfo listener wired in `_layout.tsx`. On reconnect: log + `resumePausedMutations()`.
9. `app/index.tsx` — render `<Text>` translated via `useTranslation()` + a `<View>` styled by Modern Noir tokens.
10. Type-check, lint, test, build all green. Commit.

**Commit message:**
```
feat(mobile): wire tRPC + Query + MMKV persister + i18n + tokens (Phase 3B)
```

---

## Phase 3C — Glass primitives library

**Goal:** Seven primitives + `useGlassTier()` resolver, demo screen showcasing each, snapshot tests for tier resolution.

**Files (new):**
- `apps/mobile/src/lib/glass-tier.ts` — resolver hook. Inputs: `Platform.OS`, `Platform.Version`, `AccessibilityInfo.isReduceTransparencyEnabled()`. Output: `'liquid' | 'blur' | 'flat'`.
- `apps/mobile/src/components/glass/GlassSurface.tsx` — base wrapper. Tier `liquid` → `expo-glass-effect` `GlassView`; tier `blur` → `expo-blur` `BlurView` + tinted overlay; tier `flat` → `View` with `surface-container-low` token.
- `apps/mobile/src/components/glass/GlassCard.tsx` — `GlassSurface` + 16px radius + padding.
- `apps/mobile/src/components/glass/GlassNav.tsx` — top bar, safe-area aware.
- `apps/mobile/src/components/glass/GlassTabBar.tsx` — bottom tabs, SF Symbols / Material icons.
- `apps/mobile/src/components/glass/GlassSheet.tsx` — wraps `@gorhom/bottom-sheet`.
- `apps/mobile/src/components/glass/GlassFAB.tsx` — floating action button.
- `apps/mobile/src/components/glass/GlassPill.tsx` — chip / money pill.
- `apps/mobile/src/components/glass/index.ts` — barrel.
- `apps/mobile/src/components/glass/__tests__/glass-tier.test.ts` — mock Platform + a11y; assert each tier path.
- `apps/mobile/app/_dev/glass-demo.tsx` — dev-only screen showing all 7 primitives. Routed at `/glass-demo` (gated to dev builds).

**Dependencies to add:**
- `expo-glass-effect` (iOS 26+)
- `expo-blur`
- `@gorhom/bottom-sheet`
- `react-native-reanimated`
- `react-native-gesture-handler`
- `@expo/vector-icons` or `react-native-vector-icons` (for tab icons)

**Tasks:**

1. Add deps; install; Metro/babel adjustments for Reanimated (`react-native-reanimated/plugin`).
2. `useGlassTier()` — implement per spec table:
   - `liquid` if `Platform.OS === 'ios' && parseInt(Platform.Version, 10) >= 26 && !reduceTransparency`.
   - `blur` if `Platform.OS === 'android' || (ios && version < 26)` and not `reduceTransparency`.
   - `flat` if `reduceTransparency` or `__DEV_LOW_END_FLAG__`.
3. Implement primitives one at a time, simplest first (`GlassPill` → `GlassCard` → `GlassSurface` is the dependency chain). Each renders a fallback fill underneath the glass per spec §5.
4. Write the tier-resolver test (snapshot-style on the resolution output, not on rendered RN trees).
5. Create the demo screen; verify on device that all three tiers render correctly (force `flat` by toggling reduce-transparency in iOS Accessibility settings; force `blur` by running on iOS < 26 simulator or Android).
6. Type-check, lint, test all green. Commit.

**Commit message:**
```
feat(mobile): glass primitives + useGlassTier resolver (Phase 3C)
```

---

## Phase 3D — Auth flow + auth screens + authenticated tab shell

**Goal:** Login / signup / reset screens functional against local web origin; on success the `(app)` group renders a Liquid Glass tab bar with empty placeholder tabs.

**Files (new + modified):**
- New: `apps/mobile/src/lib/auth.ts` — `@better-auth/expo` client with SecureStore bearer storage; deep-link helpers.
- Modified: `apps/mobile/src/lib/trpc.ts` — `headers()` now reads `Authorization: Bearer <token>` from SecureStore; error link catches `UNAUTHORIZED` → router `replace('/(auth)/login')`.
- New: `apps/mobile/app/(auth)/_layout.tsx` — public group, redirects to `/(app)` if session exists.
- New: `apps/mobile/app/(auth)/login.tsx` — email + password form, error toast, "forgot password" link.
- New: `apps/mobile/app/(auth)/signup.tsx` — email + password + name; on success → email-verify pending screen.
- New: `apps/mobile/app/(auth)/reset.tsx` — accepts a `token` query param (deep link); sets new password.
- New: `apps/mobile/app/(app)/_layout.tsx` — auth-guarded; renders `<Tabs />` with `GlassTabBar`. Tabs: Dashboard, Investments, EMIs, Activity, Settings (placeholders).
- New: `apps/mobile/app/(app)/index.tsx` — "Dashboard placeholder".
- New: `apps/mobile/app/(app)/investments/index.tsx` — "Investments placeholder".
- New: `apps/mobile/app/(app)/emis/index.tsx` — "EMIs placeholder".
- New: `apps/mobile/app/(app)/activity.tsx` — "Activity placeholder".
- New: `apps/mobile/app/(app)/settings.tsx` — "Settings placeholder".
- Modified: `apps/mobile/app.config.ts` — `scheme: 'phinio'` for deep links; iOS associated domains entitlement.
- Modified: `apps/mobile/app/_layout.tsx` — route guard logic moved out (now per-group via `_layout.tsx` files).
- Removed: `apps/mobile/app/index.tsx` — superseded by group layouts.

**Dependencies to add:**
- `@better-auth/expo`
- `expo-secure-store`
- `expo-linking`

**Tasks:**

1. Add deps. Configure `expo-linking` scheme + iOS associated domains. Add to `app.config.ts`.
2. `lib/auth.ts` — `createAuthClient` from `@better-auth/expo`. SecureStore plugin for bearer persistence.
3. Update `lib/trpc.ts` `headers()` to include `Authorization` when a token is available. Error link for UNAUTHORIZED.
4. Implement login screen — calls `authClient.signIn.email({ email, password })`. On success, the bearer is in SecureStore. Navigate to `/(app)`.
5. Implement signup screen — `authClient.signUp.email({ email, password, name })`. On success, route to verify-pending screen (or directly to `/(app)` if verification not required in dev).
6. Implement reset screen — accepts deep-link `token` param. Calls `authClient.resetPassword({ token, newPassword })`. Test by triggering a password-reset email manually and tapping the link on device.
7. `(auth)/_layout.tsx` — Redirect to `/(app)` if `authClient.getSession()` returns truthy.
8. `(app)/_layout.tsx` — Redirect to `/(auth)/login` if no session. Render `<Tabs />` with `tabBar={(props) => <GlassTabBar {...props} />}`.
9. Five placeholder screens with `<Text>{tabName} placeholder</Text>`.
10. Verify deep-link: from a browser, `xcrun simctl openurl booted phinio://reset?token=test` — app handles route.
11. Type-check, lint, test, build all green. Commit.
12. Push + open PR with title `Phase 3D: mobile auth flow + authenticated tab shell`.

**Commit message:**
```
feat(mobile): Better Auth + auth screens + (app) tab shell (Phase 3D)
```

---

## Out of scope (Phase 4+)

- Real domain hooks (`useEmis`, `useInvestments`, etc.) — Phase 4.
- Dashboard tiles, list views — Phase 4.
- Write flows + offline mutation replay — Phase 5.
- Push notifications + `PushSubscription.transport` migration — Phase 6.
- Snapshot/integration tests on `apps/mobile` — minimal coverage only in 3C (`glass-tier`); broader tests deferred to Phase 4+ once there's domain code to assert against.

---

## Risks specific to Phase 3

- **Metro monorepo config drift.** Without `nodeModulesPaths` + `watchFolders` pointing at the workspace root, Metro fails to resolve `@phinio/*` packages. Mitigation: 3A includes a working `metro.config.js`. Verify with `pnpm --filter @phinio/mobile dev` before declaring 3A done.
- **iOS deployment target.** `expo-glass-effect` requires iOS 26+ deployment. Set in `app.config.ts` upfront — easy to miss until first `eas build` failure.
- **Reanimated babel plugin must be LAST in `babel.config.js` plugins array.** Otherwise reanimated breaks silently.
- **`@better-auth/expo` SecureStore plugin docs are sparse.** Budget time to confirm the bearer flow works against the existing web `BetterAuth` server config. If it doesn't, fall back to manually fetching `/api/auth/sign-in/email` and storing the token via `expo-secure-store` directly.

---

## Self-review

**Spec coverage:**
- ✅ Expo Router scaffold — 3A.
- ✅ Provider wiring (tRPC, Query+persister, theme, i18n) — 3B.
- ✅ Glass primitives + tier resolver — 3C.
- ✅ Auth flow + auth screens — 3D.
- ✅ Authenticated tab shell — 3D.
- ⏭️ Domain screens (read flows) — Phase 4.

**Prerequisites confirmed:** Apple Dev account, iOS 26 device, local LAN IP origin, stacked PR shape.

**Stacking order:** 3A (no domain deps) → 3B (depends on `@phinio/trpc`, `@phinio/design-tokens`, `@phinio/i18n-resources`) → 3C (depends on 3B's theme tokens) → 3D (depends on 3B's tRPC client, 3C's `GlassTabBar`).
