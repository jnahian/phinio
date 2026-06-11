# Phase 5 — Mobile Write Flows Implementation Plan

> **For agentic workers:** Each sub-phase (5A/5B/5C/5D) is a separately mergeable stacked PR.

**Goal:** Create / edit / mark-paid for both domains on mobile, with full offline-first parity: `networkMode: 'offlineFirst'`, client-minted UUIDs + `clientMutationId`, mutation replay after force-close via a boot-time registry, and optimistic cache patches that target the **tRPC key format** (web's flat-key optimistic updates silently no-op — see PR #38's finding; mobile does it right from the start using the proxy's `queryKey()` / `queryFilter()` / `pathFilter()` helpers).

**Source spec:** `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §6.2, §7 item 5.
**Branch tree:** `feat/phase-5a-mobile-offline-writes` → `feat/phase-5b-mobile-emi-writes` → `feat/phase-5c-mobile-investment-writes` → `feat/phase-5d-mobile-settings`.
**Base for 5A:** `feat/phase-4d-mobile-lists` (PR #41).

## Phase 5A — Offline mutation infrastructure + notifications writes (pilot)

- `src/lib/uuid.ts` — `randomUUID()` via `expo-crypto` (Hermes has no `crypto.randomUUID`). New dep: `expo-crypto`.
- `src/lib/use-offline-mutation.ts` — port of web's hook: injects `clientMutationId` + runs `prepareVariables` once per logical mutation, before TanStack Query persists variables.
- `src/lib/mutation-defaults.ts` — same `mutationKeys` map as web; `registerMutationDefaults(queryClient)` registers an `offlineFirst` `mutationFn` (vanilla `trpcClient` call) for **every** key so force-close-rehydrated mutations can replay.
- `app/_layout.tsx` — registry runs before `attachPersister` restore resolves.
- `src/lib/notify.ts` — `Alert`-based error surface (mobile stand-in for web's sonner toasts; success stays silent at v1).
- `useNotifications.ts` grows `useMarkNotificationRead` / `useMarkAllNotificationsRead` / `useClearReadNotifications` with optimistic list+count patches keyed via `trpc.notifications.*.queryKey()`.
- `NotificationsSheet` — tap row → mark read; header actions mark-all / clear-read.
- Test: every `mutationKeys` entry has a registered default with `offlineFirst` (guards the replay contract).

## Phase 5B — EMI writes

- `useEmis.ts` mutations: `useCreateEmi` (prepareVariables mints EMI id + per-payment ids + optional fee-row id; optimistic detail+list built from `calculateEmi` / `generateAmortization` — same schedule the server computes on replay), `useUpdateEmi`, `useMarkPayment`, `useCompleteEmi`, `useDeleteEmi`. All cache ops via proxy key helpers.
- Screens: `emis/new.tsx` (zod-validated form: label, type, principal, rate, tenure, start date, fee, notes), detail gains mark-paid toggles on schedule rows + complete/delete actions (confirm via `Alert.alert`), `GlassFAB` on the list → `/emis/new`.

## Phase 5C — Investment writes

- `useInvestments.ts` mutations mirroring web's 13: lump-sum create/update/delete, DPS create/update/close/markDepositPaid, savings create/update/delete, addDeposit/removeDeposit, withdraw. DPS create pre-generates the deposit schedule ids client-side (mirrors web's `prepareVariables`).
- Screens: `investments/new.tsx` (mode selector → lump-sum / DPS / savings form sections), detail gains mark-deposit-paid, withdraw, complete/close, delete. Edit via the same form pre-filled (`investments/[id]/edit` deferred if scope balloons — create + mark-paid are the spec's core).

## Phase 5D — Settings / profile writes

- `settings.tsx`: profile name + currency + language (updates i18n live), sign-out (clears SecureStore → redirect to login). Currency/language mutations registered in 5A's registry.

## Out of scope

- Push notifications (Phase 6). Maestro E2E (first flow lands after 5B per plan #37 note). Web flat-key cleanup (separate PR).

## Risks

- `BottomSheetFlatList` + Pressable rows: gesture conflicts — verify on device.
- LWW `expectedUpdatedAt` handling: surfaced as an Alert when `stale: true` returns, mirroring web's toast.
