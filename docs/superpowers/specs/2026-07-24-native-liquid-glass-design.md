# Native Liquid Glass re-skin — design spec

**Date:** 2026-07-24
**Branch:** `feat/ios-native-glass` (off `main` @ `0364832`)
**Predecessor:** Modern Noir re-skin (PR #51); this replaces its view layer.

## Goal

Replace the hand-rolled Modern Noir view layer with standard SwiftUI components
so the app looks and behaves like a first-party iOS 26 app: automatic Liquid
Glass chrome, system light/dark appearance, SF Pro with Dynamic Type, native
lists/forms/controls everywhere. Phinio's brand survives as the accent color,
the investment-type palette, and the gradient hero cards.

## Decisions (user-confirmed)

| Question | Decision |
| --- | --- |
| Adoption depth | Full native — standard components replace custom chrome and controls |
| Appearance | Follow system light/dark (dark lock removed) |
| Typography | System font (SF Pro) + Dynamic Type; vendored Manrope/Inter deleted |
| Creation entry point | Tab bar's separated trailing slot (iOS 26 search-role tab styled as **+**) |
| Content surfaces | Native inset-grouped lists; gradient hero cards kept as custom headers |
| Execution | Phased in-place rewrite on one branch; app builds after every phase |

## Frozen layers

`Models/`, `Domain/`, `Sync/`, `Networking/`, `Store`, `Validators`,
`Money`, and all their tests are untouched. This is a view-layer-only change;
all 43 unit tests must pass unchanged throughout (except `FontLoadingTests`,
deleted with the fonts).

## 1. Appearance & tokens

- Remove the dark lock at the root; no `preferredColorScheme` override.
- `Tokens.swift` custom palette collapses to semantic system colors:
  `.systemGroupedBackground`, `.secondarySystemGroupedBackground`, the label
  hierarchy, `.separator`, `.tintColor`. System materials and Liquid Glass
  then adapt to appearance automatically.
- Brand remnants:
  - `AccentColor` in the asset catalog — Noir primary, with a light-mode
    variant tuned for contrast on light backgrounds.
  - Investment-type palette (`TypePalette`) — light/dark pairs per type
    (drives the allocation donut, type badges, legends).
  - Hero gradients (net-worth, DPS, EMI, savings, lump-sum detail heroes).
- `Typography.swift` deleted. Dynamic Type text styles replace every custom
  font call; money uses `.monospacedDigit()`. Vendored font files, their OFL
  licenses, `UIAppFonts`, and `FontLoadingTests` are deleted.

## 2. Chrome

- **Tab bar:** native `TabView` with three tabs (Home, Invest, EMIs) — the
  Liquid Glass tab bar comes free. `NoirTabBar` and `FabMenu` are deleted.
- **Create slot:** a fourth `Tab` with the search role renders as the
  separated circular trailing item, styled with a plus icon. The `TabView`
  selection binding intercepts it: selecting Create never navigates —
  it presents the create menu (New investment → type chooser, New EMI) as a
  sheet and restores the previous tab selection.
  - *Fallback (known off-label API risk):* if the search-role tab resists
    icon/behavior overrides, use a plain fourth tab with the same
    interception pattern. Same UX, loses the separated styling.
- **Navigation:** per-tab `NavigationStack`s and the typed route values
  (`EmiRoute`, `InvestmentRoute`, …) are preserved as-is. `DetailHeader` is
  replaced by native navigation bars: large titles on roots, standard back
  buttons, edit/delete/complete as toolbar items (destructive actions behind
  a toolbar `Menu` where there are several).
- **Profile:** stays behind the Home toolbar avatar (native `ToolbarItem`).
- **Sheets:** every form presents as a native `.sheet` with presentation
  detents and a `Form` inside; Cancel/Save as navigation-bar buttons.

## 3. Components & screens

Component mapping (old → new):

| Modern Noir | Native replacement |
| --- | --- |
| `NoirCard` / `SectionGroup` | inset-grouped `List` sections / `Section` |
| `CarvedTextField` | `TextField` in `Form` rows |
| `NoirToggle` | `Toggle` |
| `PrimaryButton` | `.buttonStyle(.glassProminent)` |
| `FilterPills` / `SegmentedTabs` | segmented `Picker` / `Menu` |
| `ProgressBar` | `ProgressView` / `Gauge` |
| Skeleton views | `.redacted(reason: .placeholder)` |
| `DetailHeader` | native navigation bar + toolbar |
| `NoirTabBar` + `FabMenu` | native `TabView` + create slot |
| Offline banner | kept, re-rendered on a system-material capsule |
| `MoneyPill`, `TypeBadge`, `StatTile` | kept as small custom leaves, semantic colors (no native equivalent) |
| `HeroCard` | kept — gradient hero headers (the one deliberate non-standard element) |
| Swift Charts donuts | unchanged (already native) |

Screens rebuild on `List`/`Form`: dashboard, both list screens, all three
investment forms + details, withdraw sheet, EMI form + detail (amortization
table as list rows with swipe/tap toggle as today), activity, notifications
(swipe actions for read/unread), profile/settings (`Form`), onboarding and
auth (native forms; welcome pager keeps its animation but on system
backgrounds).

## 4. Deletions

Each component is deleted in the phase its last consumer converts — no dead
code and no parallel tree mid-flight. Final cleanup phase removes: fonts +
licenses + `UIAppFonts` + `FontLoadingTests`, `Typography.swift`, most of
`Tokens.swift`, `NoirTabBar`, `FabMenu`, `CarvedTextField`, `NoirToggle`,
`PrimaryButton`, `Card`/`SectionGroup`, `FilterPills`, `SegmentedTabs`,
`ProgressBar`, skeleton views.

## 5. Phases

App builds and runs after every phase; each phase is verified in the
simulator in **both** light and dark before moving on.

1. Appearance unlock + semantic color/token layer (+ `AccentColor`, light
   variants for `TypePalette`)
2. Native `TabView` + create slot + navigation chrome
3. Home (dashboard + profile)
4. Invest (list, 3 forms, 3 details, withdraw sheet)
5. EMIs (list, form, detail)
6. Activity, notifications, offline banner
7. Onboarding + auth
8. Cleanup: delete orphans, light/dark consistency sweep, String Catalog sync

## 6. Testing & verification

- Unit tests: unchanged and green throughout (they cover no views).
  `FontLoadingTests` deleted in phase 8.
- Manual simulator verification per phase, both appearances, plus one
  authenticated pass against `https://phinio.jnahian.me` at the end.
- Dynamic Type spot check (XL size) on Home, one form, one detail.

## 7. Risks & follow-ups

- **Search-role create slot is off-label** — fallback documented in §2.
- **String Catalog churn:** new visible strings need one Xcode.app build to
  sync `Localizable.xcstrings`, then Bengali values from a speaker (existing
  known follow-up, unchanged).
- **Light-mode brand colors are new territory** — the type palette and
  accent need contrast checks in light mode.
- Push entitlement remains removed (free developer account); unrelated.

## Out of scope

XCUITest/snapshot coverage, any `Store`/sync change, APNs restoration,
web-app changes, app icon rework.
