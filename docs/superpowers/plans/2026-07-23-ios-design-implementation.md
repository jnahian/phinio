# iOS Modern Noir Re-skin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the existing native iOS app to the Claude Design comp, then extend the same tokens to every screen the comp omits.

**Sources (all three, in this precedence order):**

1. `docs/superpowers/specs/2026-07-23-phinio-ios-comp.dc.html` — the comp, fetched from Claude Design project `ad213339-f7d8-4220-a3fe-862ca877a771`, file `Phinio.dc.html`. **Authoritative for pixel values** (hex, radius, spacing, font weight/size, gradient, shadow). Re-fetch with `DesignSync get_file` if it changes.
2. `docs/IOS_DESIGN_BRIEF.md` — authoritative for **screen inventory and behavior**, especially the ~10 screens the comp does not draw.
3. `docs/superpowers/specs/2026-07-17-ios-app-design.md` + `docs/Phinio_PRD_v1.md` — business logic, unchanged.

---

## Global constraints

- **This is a view-layer re-skin, not a rebuild.** `Models/`, `Domain/`, `Sync/`, `Networking/`, `Support/Money.swift`, `Support/Validators.swift`, `Auth/` are **frozen**. Every edit lands in `apps/ios/Phinio/Phinio/UI/`, the new `UI/DesignSystem/`, `Resources/Fonts/`, or `Info.plist`. If a phase seems to need a domain change, stop and flag it — it almost certainly doesn't.
- **Do not port comp mechanics, only comp pixels.** The `<script data-dc-script>` block is a mock: `fmt()` rounds money with JS floats, `emiCalc`/`dpsMaturity`/`amort` are re-derivations, and the schedule checkboxes set a paid _count_ by index. The real app already has `EmiCalculator`, `DashboardStats`, `Store`, and `Decimal.currency`. **Reuse those.** CLAUDE.md: money is `Decimal`, never rounded for arithmetic.
- **Dark only.** `.preferredColorScheme(.dark)` at the app root; all colors come from the token file, never from system semantic colors (`.red`, `.green`, `.secondary`) once Phase 0 lands.
- **Localization.** The repo ships `Localizable.xcstrings` with Bengali. Every new user-visible literal must be added to the catalog. Purely decorative strings (currency glyphs, `▲`/`▼`) stay unlocalized.
- **Accessibility is not optional** (see CLAUDE.md "When NOT to be lazy"). Hand-rolled chrome loses free a11y — Phase 2 owes explicit `accessibilityLabel`/`accessibilityAddTraits(.isSelected)` on tab items and the FAB, and every tap target stays ≥ 44×44pt even where the comp draws a smaller glyph.
- **Xcode uses `fileSystemSynchronizedGroups`** — new `.swift` and `.ttf` files under `Phinio/` are picked up automatically. The **only** planned `project.pbxproj` edit is `INFOPLIST_FILE` in Phase 0.

**Build / test loop** (resolve the UDID once, it differs per machine):

```bash
UDID=$(xcrun simctl list devices available | grep -m1 "iPhone 17 Pro (" | grep -oE '[0-9A-F-]{36}')
xcodebuild build -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio -destination "id=$UDID" | tail -3
xcodebuild test  -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio -destination "id=$UDID" -only-testing:PhinioTests 2>&1 | grep -E "Test case|TEST "
```

Existing tests (`PhinioTests`) must stay green through every phase — they cover the frozen layers, so a red test means a phase reached outside `UI/`.

---

## Decisions taken (comp vs. brief conflicts)

| #   | Conflict                                                                                                                                   | Resolution                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Comp: 3-tab glass pill + **detached** circular FAB. Brief/iOS 26: native `TabView` full-width bar, no side-by-side FAB slot.               | **Hand-roll the bar** — user decision, confirmed. Pixel-match the comp; pay the a11y/safe-area cost explicitly in Phase 2.                     |
| 2   | Comp: 3 tabs, Profile reached by tapping the Home avatar. Brief §4: Profile is tab 4.                                                      | **Comp wins** — 3 tabs, Profile pushed from the Home top bar.                                                                                  |
| 3   | Comp: no Activity tab. Brief §5.18: Activity History reached from Profile.                                                                 | **Comp + brief agree** — drop the Activity tab, keep it behind Profile → Activity history.                                                     |
| 4   | Comp: FAB is global with **4** options (Investment · DPS Scheme · Savings Pot · **EMI**). Brief §5.7: FABMenu lives on Investments with 3. | **Comp wins** — one global FAB, 4 options.                                                                                                     |
| 5   | Brief §2: "No 1px dividers." Comp uses `.5px` hairlines in the summary card and Profile list.                                              | **Comp wins** — hairline `#434655` at 50% opacity, ≤ 0.5pt. The brief's rule targets 1px borders, not sub-pixel separators.                    |
| 6   | Comp legend colors DPS `#6fd0ff`; comp badge map colors DPS `#4edea3`.                                                                     | **Badge map is the source of truth.** One `TypePalette` drives badge, donut slice, and legend swatch — they must never disagree.               |
| 7   | Comp donuts are CSS `conic-gradient`.                                                                                                      | `DashboardView` already renders a Swift Charts `SectorMark` donut. **Restyle it**, don't hand-draw. Same for the EMI principal/interest donut. |
| 8   | Comp hardcodes allocation percentages, upcoming payments, "6 active · 1 completed", "across 2 loans".                                      | Wire to real `DashboardStats` / `@Query`. Comp values are mock data.                                                                           |

---

## Phase 0 — Design tokens, fonts, dark lock

Nothing downstream can start without this.

**Files:**

- Create `UI/DesignSystem/Tokens.swift` — colors, radii, shadows, spacing, gradients.
- Create `UI/DesignSystem/Typography.swift` — Manrope/Inter `Font` helpers.
- Create `Resources/Fonts/` — Manrope + Inter static `.ttf` (both OFL-licensed; Manrope via github.com/sharanda/manrope, Inter via rsms.me/inter).
- Create `Phinio/Info.plist` — `UIAppFonts` only.
- Edit `Phinio.xcodeproj/project.pbxproj` — `INFOPLIST_FILE = Phinio/Info.plist` in the app target's Debug **and** Release configs. Leave `GENERATE_INFOPLIST_FILE = YES`; Xcode merges the `INFOPLIST_KEY_*` build settings into the file.
- Edit `PhinioApp.swift` — `.preferredColorScheme(.dark)`.

**Tokens (exact values from the comp):**

_Surfaces_ — `surface #0b1326` · `surfaceLowest #060e20` (inputs, progress track, segmented control bg) · `surfaceLow #131b2e` (section group) · `surfaceHigh #222a3d` (card body) · `surfaceHighest #2d3449` (icon tile, active segment) · `pillIdle #1c2438`

_Text_ — `onSurface #dae2fd` · `onSurfaceVariant #c3c6d7` · `onSurfaceMuted #8a92a8` (metadata, dates) · `onSurfaceFaint #6b7288` (table headers, paid rows) · `tabIdle #5a6178` (idle tab label, chevrons) · `onHero #ffffff` / `#f2f5ff` · `avatarText #eaf0ff`

> `onSurfaceMuted`, `onSurfaceFaint`, `tabIdle`, `pillIdle` are **not** in the brief's table — they exist only in the comp. Add them; note the addition in a comment.

_Accent / semantic_ — `primary #b4c5ff` · `primaryContainer #2563eb` · `secondary #4edea3` · `secondaryContainer #00a572` · `tertiaryContainer #cf2c30` · `tertiaryFixedDim #ffb3ad` · `error #ffb4ab` · `outlineVariant #434655`

_Type palette_ (drives badge bg/fg, donut slice, legend swatch — bg is fg at 16% alpha):
`stock #b4c5ff` · `mutualFund #4edea3` · `gold #ffcf70` · `crypto #c79bff` · `fd #6fd0ff` · `dps #4edea3` · `savings #7fa0ff` · `other #c3c6d7`. Map the domain's full enum (`sanchayapatra`, `real_estate`, `agro_farm`, `business`) onto these — do not add new hues the comp never drew.

_Gradients_ (all `140°`, top-leading → bottom-trailing) — `netWorthHero #2563eb 0% → #1c3aa0 48% → #141d38 100%` · `summaryCard #222a3d → #1a2236` · `emiLoanHero #2563eb → #141d38` · `emiCardHero #7a4bd0 → #20182f` · `dpsHero #00a572 → #0d2a26` · `savingsHero #2563eb → #141d38` · `avatar 135° #2563eb → #00a572`

_Ambient orb_ — every hero carries one blurred circle, 200–220pt, `blur 46`, offset `top -80/-90, trailing -40`, tint: net-worth `primary @18%`, EMI `white @14%`, DPS `secondary @22%`, savings `#7fa0ff @22%`.

_Radii_ — hero 22 · detailHero 20 · summary 18 · card 16 · tile 14 · currencyTile 13 · input 11 · iconTile 11 · segment 9 · badge 8 · tabPill 32 · pill/circle `.capsule`

_Shadows_ — card `y10 blur30 #040a1a @28%` · hero `y16–18 blur40–44 @50%` · tabBar `y-2 blur30 @50%` · fabItem `y8 blur22 @55%`

_Glass_ (tab bar + FAB only) — fill `#131b2e @82%`, `.regularMaterial` backdrop, hairline border `primary @8–10%`

_Layout_ — screen horizontal padding 20 · content top inset 54 · content bottom inset 104 · card gap 12 · section gap 22

**Typography** — two families, never mixed (brief §2):

| Helper                     | Font                                          | Use                              |
| -------------------------- | --------------------------------------------- | -------------------------------- |
| `.heroNumeric`             | Manrope ExtraBold 42, tracking −0.02em        | Net worth                        |
| `.detailHeroNumeric`       | Manrope ExtraBold 40, −0.02em                 | Detail hero                      |
| `.screenTitle`             | Manrope ExtraBold 30, −0.02em                 | "Investments", "EMIs", "Profile" |
| `.detailTitle`             | Manrope ExtraBold 22                          | Detail header                    |
| `.displayName`             | Manrope Bold 20                               | User name                        |
| `.sectionTitle`            | Manrope Bold 17                               | "Upcoming Payments"              |
| `.cardTitle`               | Manrope Bold 16                               | Card name, detail section title  |
| `.amount` / `.amountLarge` | Manrope Bold 15 / 20–22                       | Row + card numerics              |
| `.amountSecondary`         | Manrope SemiBold 15                           | De-emphasised numerics           |
| `.pillText`                | Manrope Bold 11–12                            | Money pills, legend %            |
| `.tableRow`                | Manrope SemiBold 10.5                         | Amortization rows                |
| `.rowLabel`                | Inter SemiBold 14–15                          | List row primary                 |
| `.body`                    | Inter Medium 13                               | Body copy                        |
| `.caption`                 | Inter Medium 12                               | Secondary                        |
| `.meta`                    | Inter Medium 11                               | Dates, footers                   |
| `.sectionLabel`            | Inter SemiBold 12, uppercase, tracking 0.1em  | "PREFERENCES"                    |
| `.heroLabel`               | Inter SemiBold 12, uppercase, tracking 0.14em | "NET WORTH"                      |
| `.tabLabel`                | Inter SemiBold 10                             | Tab bar                          |

- [ ] Vendor the `.ttf` files (Regular / Medium / SemiBold / Bold / ExtraBold for Manrope; Regular / Medium / SemiBold / Bold for Inter). Ship only the weights the table uses.
- [ ] `Info.plist` with `UIAppFonts` listing each filename; wire `INFOPLIST_FILE`.
- [ ] **Verify the PostScript names, don't guess them.** Recent Inter releases ship as `Inter18pt-Regular`, _not_ `Inter-Regular` — referencing the CSS family name silently falls back to system font and the whole re-skin looks subtly wrong with a green build. Dump once at launch and delete the dump after:
  ```swift
  UIFont.familyNames.filter { $0.contains("Manrope") || $0.contains("Inter") }
    .forEach { print($0, UIFont.fontNames(forFamilyName: $0)) }
  ```
- [ ] Write `Tokens.swift` + `Typography.swift` from the tables above.
- [ ] Lock dark at the app root.

**Verify:** app builds; the dump prints both families with the exact PostScript names used in `Typography.swift`; a throwaway `Text("৳ 12,345").font(.heroNumeric)` renders visibly geometric (Manrope), not SF Pro. Existing tests green.

---

## Phase 1 — Shared component kit

Build once, compose everywhere. Every component takes tokens from Phase 0 — no inline hex anywhere below this line.

**File:** `UI/DesignSystem/Components.swift` (split only if it passes ~400 lines).

- [ ] `NoirCard` — `surfaceHigh`, radius 16, card shadow, 16pt padding. `SectionGroup` — `surfaceLow`, radius 16, for grouped row lists.
- [ ] `HeroCard(gradient:orbTint:)` — radius 20/22, orb overlay, hero shadow, `@ViewBuilder` content.
- [ ] `StatTile(label:value:)` — `surfaceHigh`, radius 14, centered (3-up) and leading (2-up) variants.
- [ ] `MoneyPill(percent:)` — capsule; positive `secondary` on `secondary @14–20%` with `▲`, negative `tertiaryFixedDim` on `tertiaryContainer @18%` with `▼`. Takes a `Decimal`, formats to 1 dp with an explicit sign.
- [ ] `TypeBadge(type:)` — radius 8, Inter SemiBold 11, colors from `TypePalette`.
- [ ] `FilterPills` — horizontal `ScrollView`, capsule chips; selected `primary` bg + `surface` text, idle `pillIdle` bg + `onSurfaceVariant` text. Bleeds to the screen edge (`margin: 0 -20px; padding: 0 20px` in the comp).
- [ ] `SegmentedTabs` — `surfaceLowest` track radius 12, active segment `surfaceHighest` radius 9. (Active / Completed.)
- [ ] `NoirProgressBar(fraction:tint:)` — 5pt, track `surfaceLowest`, capsule. Tint `secondary` for DPS, `primaryContainer` for EMI.
- [ ] `SectionHeader(title:trailing:)` — Manrope Bold 17 + optional `primary` trailing caption.
- [ ] `SectionLabel(_:)` — uppercase Inter SemiBold 12, tracking 0.1em, `onSurfaceMuted`.
- [ ] `NavRow(title:)` — 15pt Inter, chevron `tabIdle`, hairline separator inset 16pt from leading.
- [ ] `CarvedTextField` — `surfaceLowest` fill, radius 11, focus border → `primary`, inline error below in `error`.
- [ ] `DangerButton(_:)` — full width, radius 14, `tertiaryContainer @12%` bg, `error` text.
- [ ] `NoirToggle` — 50×30 track (`secondaryContainer` on / `surfaceHighest` off), 24pt white knob. Wrap `Toggle` with `.toggleStyle` rather than reimplementing gesture handling.
- [ ] `NoirEmptyState(title:message:)` — Manrope Bold 17 + Inter Medium 13, centered, 48pt vertical padding. Replaces `EmptyStateView`'s `ContentUnavailableView` (system chrome can't take the tokens).
- [ ] `AvatarView(initials:size:)` — avatar gradient, Manrope Bold, circular.
- [ ] `IconTile(size:radius:)` — `surfaceHigh`/`surfaceHighest` rounded square behind an SF Symbol.
- [ ] Delete `EmptyStateView` from `UI/SharedViews.swift` once call sites migrate (Phases 3–8); keep `MoneyText` and restyle `UpcomingRow` in Phase 3.

**Verify:** a scratch `#Preview` gallery renders every component against `surface`; visually diff against the comp's corresponding fragment. Build + tests green. Delete the gallery before the phase closes, or keep it as `Components.swift`'s own `#Preview`.

---

## Phase 2 — App chrome: 3-tab glass pill, detached FAB, nav restructure

The structural phase. Everything visual after this is per-screen.

**Files:** rewrite `UI/MainTabView.swift`; new `UI/DesignSystem/NoirTabBar.swift`, `UI/DesignSystem/FabMenu.swift`, `UI/Dashboard/ProfileView.swift` (rename target for `SettingsView`).

- [ ] Replace `TabView` with a `ZStack` of three **always-instantiated** `NavigationStack`s (`.home`, `.invest`, `.emis`), each with a retained `NavigationPath`, switched by z-order + `.opacity`/`.zIndex` — **not** by `if tab == …`, which tears the stacks down and loses each tab's back stack on every switch. Today's `investmentsPath` / `emisPath` behavior must survive; the deep-link handler depends on it.
- [ ] **Attach the bar and FAB to each stack's _root view_** via `.safeAreaInset(edge: .bottom)` — **not** as a ZStack sibling above the stacks. Native `TabView` auto-hid its bar on push; the rewrite loses that, and `.toolbar(.hidden, for: .tabBar)` is a no-op once there's no `TabView`. Root attachment makes pushed detail screens cover the chrome for free, matching the comp's own z-order (details `z-index:50`, bar `45`), with no path-depth bookkeeping.
- [ ] `NoirTabBar` — bottom `HStack`, 16pt horizontal / 26pt bottom padding, 12pt gap. Left: flexible glass pill, radius 32, **`.glassEffect(in: .rect(cornerRadius: 32))`** (brief §3 — native Liquid Glass, and closer to the comp's `blur(22) saturate(160%)` than a flat material) over `surfaceLow @82%` with a hairline `primary @8%` border, 8pt inner padding, 3 equal columns. Each item: 23pt SF Symbol over Inter SemiBold 10 label, 5pt gap, 9pt vertical padding, radius 22, active background `primary @16%`, active tint `onSurface` / idle `tabIdle`. Symbols: `house`, `chart.line.uptrend.xyaxis`, `creditcard`. Wrap the pill and FAB in one `GlassEffectContainer` so the two glass surfaces blend as a pair.
- [ ] Detached FAB — 62pt circle, same `.glassEffect(in: .circle)`, `plus` glyph 27pt `primary`, rotates 45° when the menu is open (`.spring(duration: 0.25, bounce: 0.3)`).
- [ ] **A11y debt from hand-rolling:** each tab item gets `accessibilityLabel` + `accessibilityAddTraits(.isSelected)` + `.isButton`; the FAB gets a label and `.isButton`. Respect `safeAreaInsets.bottom` rather than a hardcoded 26pt. Add `.safeAreaInset(edge: .bottom)` (or matching content padding) so scroll content clears the bar — the comp's 104pt bottom inset assumes this.
- [ ] `FabMenu` — scrim `surfaceLowest @62%` + 3pt blur, tap-to-dismiss, `.animation(.easeOut(duration: 0.18))`. Options stack bottom-trailing at 114pt from the bottom, 13pt gap, each = label chip (`surfaceHigh`, radius 11, fabItem shadow) + 50pt `surfaceHighest` circle icon, staggered in at 0.02/0.06/0.10/0.14s with `.spring(duration: 0.24, bounce: 0.35)`. Four options → Add Investment · Add DPS · Add Savings Pot · Add EMI, each presented as a **`.sheet`** (not a push). A global FAB has no unambiguous stack to push onto — "Add EMI" tapped from Home would otherwise land an EMI form on the Home stack — and modal presentation is the iOS convention for create flows anyway. On save, dismiss and (if the user isn't already there) switch to the owning tab.
- [ ] Home top bar: greeting + user name (Manrope Bold 20) on the leading side; 42pt bell button with unread `tertiaryContainer` badge (1.5pt `surface` ring) and 42pt gradient avatar on the trailing side. Bell → Notification Center sheet, avatar → push Profile.
- [ ] Rename `SettingsView` → `ProfileView`; reach it by push from the avatar, not from a toolbar gear. Remove the Activity tab; Activity History becomes a push from Profile.
- [ ] Rework the deep-link handler in `MainTabView` for 3 tabs (`.emi` → `.emis`, `.dps` → `.invest`) — unchanged semantics, new enum.

**Verify:** `DeepLinkTests` still green; tapping a notification deep link lands on the right detail with the right tab selected. **Pushing any detail screen fully covers the tab bar and FAB** — no floating chrome over a detail. Switching tabs mid-stack and switching back restores the same pushed screen. VoiceOver announces each tab with its selected state. Bar clears the home indicator on a device without a physical home button. No content hidden behind the bar on any of the three tabs.

---

## Phase 3 — Home / Dashboard

**File:** `UI/Dashboard/DashboardView.swift`; restyle `UpcomingRow` in `UI/SharedViews.swift`.

- [ ] Net-worth `HeroCard` — `netWorthHero` gradient, radius 22, `NET WORTH` hero label, `MoneyText` at `.heroNumeric`, `MoneyPill` for gain % + a subtitle counting real investments and EMIs (`"\(n) investments · \(m) EMIs"`, localized, pluralized).
- [ ] Quick-stats row — 2-up `NoirCard`s: "Current value" (+ gain pill) and "Monthly EMI" (+ real loan count as the caption).
- [ ] "Upcoming Payments" section — `SectionHeader` with "Next 30 days" trailing; `SectionGroup` of rows: 38pt `IconTile`, label + relative due (`dueLabel(daysUntil:)`), trailing `MoneyText`. Overdue rows tint the due line `tertiaryFixedDim` (brief §6 — **not** full error red). Keep today's typed `NavigationLink(value:)` routing; the comment at `DashboardView.swift:142` explains why an `AnyHashable` box breaks it.
- [ ] Allocation card — `SectionGroup`, 120pt Swift Charts donut (`innerRadius: .ratio(0.73)` to match the comp's 16pt inset ring), centered total + "total" caption via `.chartBackground`. Slice colors from `TypePalette`, top-5 legend to the trailing side with matching 9pt swatches. Wire the brief §5.6 interaction: tapping a legend row highlights its slice and dims the rest; dimmed rows stay tappable; tapping the selected row clears.
- [ ] Empty state — `NoirEmptyState` + two CTA cards ("Add your first investment" / "Add your first EMI") opening the corresponding FAB destinations.
- [ ] Keep `.refreshable { await sync.syncNow() }`; move the sync/offline badge from the toolbar into an `OfflineBanner` strip below the top bar (brief §3, §6).

**Verify:** side-by-side against the comp's HOME block at 402×874. Numbers still come from `DashboardStats` — `DashboardStatsTests` green. Pull-to-refresh works. Empty account shows the CTA state, not a blank hero.

---

## Phase 4 — Investments list

**File:** `UI/Investments/InvestmentsListView.swift`.

- [ ] `.screenTitle` "Investments" + count subtitle from real data (`"\(active) active · \(completed) completed"`, localized).
- [ ] Summary card — `summaryCard` gradient, radius 18, 3 columns (Invested | Value | Return) with hairline `outlineVariant @60%` dividers between; Return tinted `secondary` / `tertiaryFixedDim` by sign.
- [ ] `SegmentedTabs` Active / Completed, then `FilterPills` (All · Stocks · Mutual Fund · FD · Gold · Crypto · DPS · Savings · Other — driven off the domain enum, not a hardcoded list).
- [ ] Three card variants in one `NoirCard`, switched on `mode`:
  - **Lump-sum** — name + `TypeBadge`; "Invested" (Manrope SemiBold 15, `onSurfaceVariant`) vs. "Current value"/"Exit value" (Manrope Bold 20, `onSurface`); footer = date `meta` + `MoneyPill`.
  - **DPS** — green `DPS` badge; "Deposited" (Bold 20) vs. "Maturity" (SemiBold 15, `secondary`); `paid / tenure months`; `NoirProgressBar` tinted `secondary`; footer of monthly · rate · next due in `onSurfaceMuted`.
  - **Savings** — blue `Savings` badge; deposit count + "Deposited …" on the leading side, "Balance" (Bold 20) trailing.
- [ ] `NoirEmptyState` "Nothing here yet / No investments match this filter." when filters produce nothing.
- [ ] Remove this screen's own FAB — the global one from Phase 2 owns creation now.

**Verify:** each of the three variants renders against the comp's INVEST block. Filters and status tabs still narrow the `@Query` results correctly. `StoreInvestmentTests` green.

---

## Phase 5 — EMIs list

**File:** `UI/Emis/EmiListView.swift`.

- [ ] `.screenTitle` "EMIs" + 3-column summary card (Active | Monthly | Remaining), Remaining tinted `tertiaryFixedDim`.
- [ ] `FilterPills` All · Bank Loan · Credit Card.
- [ ] EMI card — 42pt `surfaceHighest` `IconTile` (`house` tinted `primary` for a loan, `creditcard` tinted `crypto` for a card), name + type caption, trailing monthly EMI + "per month"; then "Remaining …" / "paid / total months", `NoirProgressBar` tinted `primaryContainer`, and "Next due …" in `onSurfaceMuted`.
- [ ] `NoirEmptyState` when there are no EMIs; remove the screen-local FAB.

**Verify:** matches the comp's EMIS block. Amounts still come from `EmiCalculator` / `DashboardStats` — no re-derivation in the view. `StoreEmiTests` + `EmiCalculatorTests` green.

---

## Phase 6 — Detail screens: EMI, DPS, Savings

Three screens, one shared header + hero pattern — do them together so the pattern gets factored once.

**Files:** `UI/Emis/EmiDetailView.swift`, `UI/Investments/DpsDetailView.swift`, `UI/Investments/SavingsDetailView.swift`; add `DetailHeader` to `Components.swift`.

- [ ] `DetailHeader` — 40pt circular back button (`primary @8%` bg), `.detailTitle` with optional subtitle line, optional trailing accessory (badge / 38pt pencil / "Edit" text). Hide the system nav bar with `.toolbar(.hidden, for: .navigationBar)`. The custom tab bar and FAB need no hiding modifier — Phase 2 attaches them to each stack's root, so a push covers them.
- [ ] **EMI Detail** — `emiLoanHero` / `emiCardHero` gradient by type; "REMAINING BALANCE" + `.detailHeroNumeric` + "৳X/mo". 3 `StatTile`s (Paid months `p / n` | Remaining | Interest paid). Principal-vs-Interest Swift Charts donut, 110pt, `primaryContainer` / `crypto` slices, centered "TOTAL" + total payment, legend to the trailing side with amounts. Amortization table: 7-column grid `22 / 40 / 1fr / 1fr / 1fr / 1fr / 26`, Manrope SemiBold 10.5 uppercase headers in `onSurfaceFaint`; paid rows transparent + `onSurfaceFaint`, unpaid rows `primaryContainer @6%` + `onSurface`, overdue rows `tertiaryFixedDim`; trailing 18pt checkbox (`secondaryContainer` filled with a white check when paid, `outlineVariant` 1.5pt outline when not). **Tapping a row toggles that one payment through `Store`** — optimistic, rolls back on error (brief §5.17). Do **not** port the comp's paid-count-by-index mock. `DangerButton` "Delete EMI" with `confirmationDialog`.
- [ ] **DPS Detail** — `dpsHero` gradient; "TOTAL DEPOSITED" + `.detailHeroNumeric` + `paid / tenure months` + a 6pt white-on-`white @20%` progress bar inside the hero. Subtitle "DPS · {Simple|Compound} interest · X% p.a." 3 `StatTile`s (Monthly deposit | Maturity value | Interest earned). Schedule rows: 30pt number, amount over "{month} · bal {accrued}", trailing 22pt checkbox; unpaid rows `secondary @6%`; overdue `tertiaryFixedDim`. Keep the existing inline edit-name card, auto-maturation, and premature-close behavior — restyle only. `DangerButton` "Delete DPS scheme".
- [ ] **Savings Detail** — `savingsHero` gradient; "CURRENT BALANCE" + `.detailHeroNumeric` + `MoneyPill`. 2 leading-aligned `StatTile`s (Total deposited | Deposits). "+ Add deposit" — full-width, radius 14, 1.5pt **dashed** `outlineVariant` border, `primary` text — expanding an inline `SectionGroup` form (Amount, Date, Notes) with a `primaryContainer` submit button. Deposit history rows: 38pt `secondary @12%` `IconTile` with a down-arrow, note (or "Deposit") over date, trailing `+ ৳X` in `secondary`. Keep the existing remove-with-inline-confirm. `DangerButton` "Delete savings pot".

**Verify:** each screen matches its comp block. Toggling a payment/installment persists through `Store` and survives a relaunch; forcing an API failure rolls the row back. `StoreEmiTests` / `StoreInvestmentTests` / `EmiCalculatorTests` green.

---

## Phase 7 — Profile

**File:** `UI/Dashboard/ProfileView.swift` (renamed from `SettingsView.swift`).

- [ ] `DetailHeader`-style back button + `.screenTitle` "Profile". 88pt gradient `AvatarView`, name (Manrope Bold 20) with a pencil affordance for inline rename, email in `onSurfaceVariant`.
- [ ] `SectionLabel("Preferences")` → currency card: two tonal tiles, radius 13, selected `primaryContainer @18%` + `primary @40%` hairline border, showing "৳ BDT / Bangladeshi Taka" and "$ USD / US Dollar". Changing it must re-render every formatted amount app-wide (`MoneyText` already reads `Profile.preferredCurrency` via `@Query` — confirm, don't rebuild).
- [ ] Payment-reminders card with `NoirToggle` and three distinct helper strings under it — granted / denied / unsupported (brief §5.9). The comp only drew on/off; the denied copy ("Notifications are off in iOS Settings") plus a deep link to Settings comes from the brief.
- [ ] `SectionLabel("Account")` → `SectionGroup` of `NavRow`s: Activity history (push) · Change password (sheet) · Sign out (`error`-tinted icon + label, `confirmationDialog`).
- [ ] `SectionLabel("Developer tools")` → Load test data (sheet with category fixtures + "wipe existing first") · Clear all my data (`error`, `confirmationDialog`). Keep the existing sync-issues surface — fold it into the Account group rather than dropping it.
- [ ] Also add the language toggle the comp omits but the shipped app has (`Localizable.xcstrings` carries Bengali) — same tonal-tile treatment as currency.

**Verify:** matches the comp's PROFILE block. Currency switch re-formats Home and both lists. All three notification permission states show the right helper copy (test by revoking permission in Simulator settings). Sign-out still clears the Keychain and returns to onboarding.

---

## Phase 8 — Consistency pass on the screens the comp doesn't draw

The comp covers 8 surfaces; the brief enumerates ~18. This phase closes the gap — same tokens, no new visual language.

**Files:** `UI/Onboarding/OnboardingView.swift`, `UI/Onboarding/AuthStepView.swift`, `UI/Investments/LumpSumFormView.swift`, `LumpSumDetailView.swift`, `DpsFormView.swift`, `SavingsFormView.swift`, `WithdrawSheet.swift`, `UI/Emis/EmiFormView.swift`, `UI/Activity/ActivityView.swift`, `UI/Activity/NotificationsView.swift`.

- [ ] **Get Started** (brief §5.1) — the one screen with net-new work: ambient orb, 128–160pt glass logo tile with `secondary` accent dot, "Phinio" wordmark at Manrope ExtraBold 48, uppercase tagline, primary + text buttons. Entry chain via `PhaseAnimator` on the brief's timeline (orb 0.0s breathing 6s autoreverse → tile 0.1s → dot 0.4s → wordmark 0.5s → tagline 0.7s → buttons 0.9s `.blurReplace`), `.spring(duration: 0.5, bounce: 0.3)`.
- [ ] **Login / Signup / Check Email / Forgot Password** — `CarvedTextField`, full-width `primaryContainer` buttons with a loading state, `error`-tinted inline field errors plus a form-level error slot, `primary` text links. Signup's currency selector reuses Phase 7's tonal tiles.
- [ ] **All forms** (lump-sum, DPS, EMI, savings, withdraw) — presented as **sheets** from the Phase 2 FAB (edit flows stay pushes from their detail screen). `CarvedTextField` throughout, `SectionLabel` group headers, submit button pinned to the bottom, `.presentationBackground(Tokens.surface)` so the sheet doesn't fall back to system chrome. Keep the live maturity / EMI previews (brief §5.12, §5.16) — restyle as a `NoirCard` of `StatTile`s. Interest-type and EMI-type selectors reuse the tonal-tile grid. Replace `Form`/`List` with `ScrollView` + tokens where stock chrome refuses the palette.
- [ ] **Lump-sum detail + Edit** — hero card (reuse `HeroCard` with the net-worth gradient), 3 `StatTile`s, `TypeBadge`, status toggle revealing Exit Value / Completed Date, `DangerButton` delete.
- [ ] **Activity History** — `SectionGroup` rows with per-action `IconTile` tints (create `secondary`, update `primary`, delete `error`), relative time in `onSurfaceMuted`, field diffs (old → new) for updates, 15/page with a "Load more" footer. Keep the existing online-only offline message, restyled.
- [ ] **Notification Center** — sheet with `.presentationBackground`; unread-first rows with a `primary` unread dot, "Mark all read" in `primary`, `NoirEmptyState` when empty.
- [ ] **Cross-cutting** — `OfflineBanner` below every top bar (brief §6); `.redacted(reason: .placeholder)` skeletons on first load in place of full-screen spinners; a `NoirEmptyState` on every list.
- [ ] Sweep: `grep -rn "Color(red:\|#\|\.red\|\.green\|\.secondary\|systemFont" UI/` returns only `DesignSystem/`. Every literal added this phase is in `Localizable.xcstrings` with a Bengali value.

**Verify:** full `xcodebuild test` green. Walk every screen in the simulator in both en and bn — no system-default typography, no unstyled `Form`, no untranslated string. Screenshot the 8 comped screens against the comp one final time.

---

## Out of scope (say so rather than half-doing it)

- No XCUITest or snapshot-test harness — visual verification stays manual, matching the existing plans and avoiding a new dependency.
- No light mode, no theme toggle, no iPad/landscape layout.
- No changes to the web app under `src/` — this plan is `apps/ios/` only.
- The comp's mock `db`, `fmt`, `emiCalc`, `dpsMaturity`, `amort`, and `dpsSchedule` are reference material and are never ported.
