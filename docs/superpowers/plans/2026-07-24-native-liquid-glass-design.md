# Native Liquid Glass Re-skin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled Modern Noir view layer with standard SwiftUI components so Phinio looks and behaves like a first-party iOS 26 app (Liquid Glass chrome, system light/dark, SF Pro + Dynamic Type, native lists/forms), keeping the brand as accent color, type palette, and gradient hero cards.

**Architecture:** Phased in-place rewrite on `feat/ios-native-glass`. Each task converts one slice of the view layer to native components and deletes the Modern Noir components whose last consumer just converted. The app builds and runs after every task.

**Tech Stack:** SwiftUI (iOS 26 SDK, deployment target 26.0), SwiftData, Swift Charts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-24-native-liquid-glass-design.md`

## Global Constraints

- **Frozen layers:** `Models/`, `Domain/`, `Sync/`, `Networking/`, `Auth/`, `Support/` (`Store`, `Validators`, `Money`, `Formatting`, `DeepLink`, `PushManager`, `AppConfig`, `Keychain`) and all their tests are untouched. Every edit lands in `apps/ios/Phinio/Phinio/UI/`, `PhinioApp.swift`, `Assets.xcassets`, `Info.plist`, or (Task 9 only) `Resources/Fonts/` + `PhinioTests/FontLoadingTests.swift`.
- **All 44 unit tests stay green throughout** (they cover no views). The only test change in the whole plan is deleting `FontLoadingTests.swift` (1 test) in Task 9, leaving 43. The spec's "43 tests" was stale — verified by `grep -rn "@Test" apps/ios/Phinio/PhinioTests/*.swift | wc -l`.
- **No snapshot/XCUITest coverage** (spec: out of scope). The verify loop per task is: `xcodebuild build` succeeds → `PhinioTests` green → manual simulator check in **both light and dark** appearance.
- **Money is `Decimal`** — never coerce to `Double` for arithmetic. Money text always gets `.monospacedDigit()`.
- **Xcode project uses `fileSystemSynchronizedGroups`** — creating/deleting `.swift` files needs no `project.pbxproj` edit. Do not edit `project.pbxproj` at all.
- **Deletion rule (spec §4):** a Modern Noir component is deleted in the task where its last consumer converts. Before each deletion, run the grep given in that task and confirm zero remaining references.
- Hero gradient cards (`HeroCard` + `Gradients`) are the one deliberate non-standard element — white text on fixed dark gradients in both appearances.
- New user-visible strings will be synced into `Localizable.xcstrings` by a build (Task 9); Bengali values are a known follow-up, do not hand-edit the catalog.

**Build / test loop** (run from repo root `/Users/nahian/Projects/phinio`; resolve UDID once per session — the machine has an iPhone 16 Pro simulator):

```bash
UDID=$(xcrun simctl list devices available | grep -m1 "iPhone 16 Pro (" | grep -oE '[0-9A-F-]{36}')
xcodebuild build -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio \
  -destination "id=$UDID" -derivedDataPath apps/ios/DerivedData 2>&1 | tail -3
xcodebuild test -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio \
  -destination "id=$UDID" -derivedDataPath apps/ios/DerivedData \
  -only-testing:PhinioTests 2>&1 | grep -E "Test Suite|TEST"
```

**Simulator visual check** (used at the end of every task):

```bash
xcrun simctl boot "$UDID" 2>/dev/null; open -a Simulator
xcrun simctl install "$UDID" apps/ios/DerivedData/Build/Products/Debug-iphonesimulator/Phinio.app
xcrun simctl launch "$UDID" com.phinio.app
xcrun simctl ui "$UDID" appearance light   # check screens
xcrun simctl ui "$UDID" appearance dark    # check again
```

**Style translation tables** — use these everywhere; do not invent new mappings:

| Modern Noir token | Native replacement |
| --- | --- |
| `Color.surface` (screen bg) | delete the `.background(...)` — `List`/`Form` default grouped background |
| `Color.surfaceLow` / `.surfaceHigh` (card bg) | delete — default list row bg; standalone tiles use `Color(.secondarySystemGroupedBackground)` |
| `Color.surfaceLowest` / `.surfaceHighest` | `Color(.tertiarySystemFill)` |
| `Color.onSurface` | `.primary` (usually just delete the modifier) |
| `Color.onSurfaceVariant` / `.onSurfaceMuted` | `.secondary` |
| `Color.onSurfaceFaint` / `.tabIdle` | `.tertiary` / `Color(.tertiaryLabel)` |
| `Color.onHero` / `.onHeroVariant` | `.white` (hero cards only) |
| `Color.brandPrimary` (interactive) | `.tint` / `Color.accentColor` |
| `Color.brandSecondary` / `.brandSecondaryHero` / `.secondaryContainer` (gains, paid) | `.green` |
| `Color.error` / `.tertiaryContainer` / `.tertiaryFixedDim` (losses, overdue, destructive) | `.red` |
| `Color.primaryContainer` | `Color.accentColor` (outside gradients) |
| `Color.outlineVariant` | `Color(.separator)` |

| Modern Noir font | Native replacement |
| --- | --- |
| `.heroNumeric` / `.detailHeroNumeric` | `.largeTitle.weight(.heavy).monospacedDigit()` / `.largeTitle.weight(.bold).monospacedDigit()` |
| `.screenTitle` | `.navigationTitle(...)` large title (delete the Text) |
| `.detailTitle` | `.navigationTitle(...)` + `.navigationBarTitleDisplayMode(.inline)` |
| `.sectionTitle` / `SectionHeader` | `Section` header text (system default) |
| `.cardTitle` | `.headline` |
| `.displayName` | `.title3.weight(.semibold)` |
| `.amountLarge(20/22)` | `.title3.weight(.bold).monospacedDigit()` |
| `.amount` (15) | `.subheadline.weight(.semibold).monospacedDigit()` |
| `.amountSecondary` | `.subheadline.monospacedDigit()` |
| `.rowLabel(13–15)` | `.body` |
| `.body` (13) | `.subheadline` |
| `.caption` (12) | `.footnote` |
| `.meta` (11) | `.caption` |
| `.badgeLabel` | `.caption2.weight(.semibold)` |
| `.tableRow` (10.5) | `.caption2.monospacedDigit()` |
| `.pillText` | `.caption.weight(.bold).monospacedDigit()` |
| `.tracking(...)` calls | delete (system font uses default tracking) |

All `Font.custom("Manrope-…"/"Inter-…", …)` calls map by size to the nearest row above.

---

### Task 1: Appearance unlock + adaptive brand color layer

**Files:**
- Modify: `apps/ios/Phinio/Phinio/PhinioApp.swift:31`
- Modify: `apps/ios/Phinio/Phinio/Assets.xcassets/AccentColor.colorset/Contents.json`
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Tokens.swift` (TypePalette only — everything else in the file stays until Task 9)

**Interfaces:**
- Produces: `TypePalette.stock/.mutualFund/.gold/.crypto/.fd/.dps/.savings/.other: Color` (now light/dark adaptive), `TypePalette.foreground(for: String) -> Color`, `TypePalette.background(for: String) -> Color` — signatures unchanged, all later tasks keep calling them.
- Produces: asset-catalog `AccentColor` — later tasks use it via `.tint` / `Color.accentColor`.

- [ ] **Step 1: Remove the dark lock**

In `PhinioApp.swift`, delete this line from `body` (the `RootView()` modifier chain):

```swift
        .preferredColorScheme(.dark)
```

- [ ] **Step 2: Fill in AccentColor**

Replace the entire contents of `Assets.xcassets/AccentColor.colorset/Contents.json` with (any/light = `#2563EB` for contrast on light backgrounds, dark = Noir primary `#B4C5FF`):

```json
{
  "colors" : [
    {
      "color" : {
        "color-space" : "srgb",
        "components" : {
          "alpha" : "1.000",
          "blue" : "0xEB",
          "green" : "0x63",
          "red" : "0x25"
        }
      },
      "idiom" : "universal"
    },
    {
      "appearances" : [
        {
          "appearance" : "luminosity",
          "value" : "dark"
        }
      ],
      "color" : {
        "color-space" : "srgb",
        "components" : {
          "alpha" : "1.000",
          "blue" : "0xFF",
          "green" : "0xC5",
          "red" : "0xB4"
        }
      },
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

- [ ] **Step 3: Make TypePalette adaptive**

In `Tokens.swift`:

a) Change the import block at the top of the file to:

```swift
import SwiftUI
import UIKit
```

b) Insert these helpers immediately above `enum TypePalette` (the existing `private extension Color { init(hex:) }` at the top of the file stays — other tokens still use it):

```swift
private extension UIColor {
  convenience init(hex: UInt32) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1)
  }
}

private extension Color {
  /// Adaptive brand color: `light` in light appearance, `dark` in dark.
  init(light: UInt32, dark: UInt32) {
    self.init(uiColor: UIColor { trait in
      trait.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
    })
  }
}
```

c) Replace the eight color constants inside `TypePalette` (the doc comments above the enum and on `dps`, plus `foreground(for:)`/`background(for:)`, stay exactly as they are — the dark values are the existing Noir hues, the light values are darkened same-hue variants for contrast on light backgrounds):

```swift
  static let stock = Color(light: 0x3D5AC8, dark: 0xB4C5FF)
  static let mutualFund = Color(light: 0x0E8F5F, dark: 0x4EDEA3)
  static let gold = Color(light: 0xA1720E, dark: 0xFFCF70)
  static let crypto = Color(light: 0x7C3AED, dark: 0xC79BFF)
  static let fd = Color(light: 0x0A7EA4, dark: 0x6FD0FF)
  static let dps = Color(light: 0xC2447E, dark: 0xFF9ECD)
  /// Light value is a deep navy, not a mid indigo like the dark one. Darkening
  /// both blues for light mode collapsed savings onto stock (CIELAB DeltaE 5.2 —
  /// perceptually identical), drawing two identical allocation slices. Navy
  /// restores the lightness separation (DeltaE 37.9 from stock, >=24 from all).
  static let savings = Color(light: 0x1B3B6D, dark: 0x7FA0FF)
  static let other = Color(light: 0x6B7280, dark: 0xC3C6D7)
```

- [ ] **Step 4: Build**

Run the build command from the header. Expected: `BUILD SUCCEEDED`.

- [ ] **Step 5: Unit tests**

Run the test command from the header. Expected: all suites pass (44 tests).

- [ ] **Step 6: Simulator check**

Launch in the simulator, toggle light appearance. Expected at this stage: app launches and works; screens are still hand-painted dark (that is correct mid-flight — Tasks 3–8 convert them). System chrome (sheets, form controls, keyboard) now follows the appearance. Toggle back to dark: identical to before this task.

- [ ] **Step 7: Commit**

```bash
git add apps/ios/Phinio/Phinio/PhinioApp.swift \
  apps/ios/Phinio/Phinio/Assets.xcassets/AccentColor.colorset/Contents.json \
  apps/ios/Phinio/Phinio/UI/DesignSystem/Tokens.swift
git commit -m "💄 style(ios): unlock system appearance, adaptive AccentColor + TypePalette"
```

---

### Task 2: Native TabView shell + create slot

**Files:**
- Rewrite: `apps/ios/Phinio/Phinio/UI/MainTabView.swift`
- Delete: `apps/ios/Phinio/Phinio/UI/DesignSystem/NoirTabBar.swift` (defines `AppTab` — moves to MainTabView.swift)
- Delete: `apps/ios/Phinio/Phinio/UI/DesignSystem/FabMenu.swift` (defines `CreateSheet` — moves to MainTabView.swift)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components+Controls.swift` (delete the `#Preview("Component Kit")` block — it references components that die across Tasks 2–8)

**Interfaces:**
- Produces: `enum AppTab: Hashable { case home, invest, emis, create }`
- Produces: `enum CreateSheet: String, Identifiable, CaseIterable { case investment, dps, savings, emi }` with `label: LocalizedStringKey`, `symbol: String`, `owningTab: AppTab` (`tint` is dropped — its only consumer was FabMenu).
- Produces: `CreateMenuSheet(onSelect: (CreateSheet) -> Void)` — used only by MainTabView.
- Consumes: `DashboardView(onCreate:)`, `InvestmentsListView()`, `EmiListView()`, `EmiDetailView(emiId:)`, `InvestmentDetailRouter(investmentId:)`, `ProfileView()`, `ActivityView()`, `NotificationsView()` — all unchanged in this task.
- Route types `EmiRoute`/`InvestmentRoute`/`ProfileRoute`/`ActivityRoute` are preserved verbatim.

- [ ] **Step 1: Rewrite MainTabView.swift**

Replace the entire file with the code below. Notes on what it does: native `TabView` with three `Tab`s plus a search-role fourth tab that renders as the separated trailing item; the selection binding intercepts `.create` — it presents the create menu and never assigns `tab`, so the previous selection is restored for free. The hand-rolled ZStack/`InactiveStack`/`.hidden()` machinery is gone (native `TabView` keeps every tab's `NavigationStack` alive and handles accessibility). `HomeTopBar` is kept verbatim for now — Task 3 dissolves it into the Dashboard toolbar.

```swift
import SwiftData
import SwiftUI

struct EmiRoute: Hashable { let id: String }
struct InvestmentRoute: Hashable { let id: String }
struct ProfileRoute: Hashable {}
struct ActivityRoute: Hashable {}

enum AppTab: Hashable { case home, invest, emis, create }

/// The four global create flows behind the tab bar's + slot.
enum CreateSheet: String, Identifiable, CaseIterable {
  case investment, dps, savings, emi
  var id: String { rawValue }

  var label: LocalizedStringKey {
    switch self {
    case .investment: "Investment"
    case .dps: "DPS Scheme"
    case .savings: "Savings Pot"
    case .emi: "EMI"
    }
  }

  var symbol: String {
    switch self {
    case .investment: "chart.line.uptrend.xyaxis"
    case .dps: "calendar"
    case .savings: "banknote"
    case .emi: "creditcard"
    }
  }

  /// Tab that owns the created record — selected on create so the form sheet
  /// dismisses onto the right list.
  var owningTab: AppTab { self == .emi ? .emis : .invest }
}

struct MainTabView: View {
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @EnvironmentObject private var sync: SyncEngine
  @State private var tab: AppTab = .home
  @State private var homePath = NavigationPath()
  @State private var investmentsPath = NavigationPath()
  @State private var emisPath = NavigationPath()
  @State private var showCreateMenu = false
  @State private var creating: CreateSheet?
  @State private var showNotifications = false

  var body: some View {
    TabView(selection: Binding(
      get: { tab },
      // Selecting Create never navigates: present the menu and leave `tab`
      // untouched, so the previous selection is restored automatically.
      set: { selected in
        if selected == .create {
          showCreateMenu = true
        } else {
          tab = selected
        }
      }
    )) {
      Tab("Home", systemImage: "house", value: AppTab.home) {
        NavigationStack(path: $homePath) {
          VStack(spacing: 0) {
            HomeTopBar(showNotifications: $showNotifications)
            if sync.state == .offline { OfflineBanner() }
            DashboardView { creating = $0 }
          }
          .toolbar(.hidden, for: .navigationBar)
          .navigationDestination(for: EmiRoute.self) { EmiDetailView(emiId: $0.id) }
          .navigationDestination(for: InvestmentRoute.self) {
            InvestmentDetailRouter(investmentId: $0.id)
          }
          .navigationDestination(for: ProfileRoute.self) { _ in ProfileView() }
          .navigationDestination(for: ActivityRoute.self) { _ in ActivityView() }
        }
      }

      Tab("Invest", systemImage: "chart.line.uptrend.xyaxis", value: AppTab.invest) {
        NavigationStack(path: $investmentsPath) {
          InvestmentsListView()
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
        }
      }

      Tab("EMIs", systemImage: "creditcard", value: AppTab.emis) {
        NavigationStack(path: $emisPath) {
          EmiListView()
            .navigationDestination(for: EmiRoute.self) { EmiDetailView(emiId: $0.id) }
        }
      }

      // Off-label (spec §2): the search role renders as the separated circular
      // trailing slot; plus icon + "Add" label restyle it as Create. Fallback if
      // the icon/label overrides don't take: delete `role: .search` — same
      // interception UX, loses the separated styling.
      Tab("Add", systemImage: "plus", value: AppTab.create, role: .search) {
        Color.clear
      }
    }
    .sheet(isPresented: $showCreateMenu) {
      CreateMenuSheet { option in
        showCreateMenu = false
        tab = option.owningTab
        creating = option
      }
    }
    .sheet(isPresented: $showNotifications) {
      NavigationStack { NotificationsView() }
    }
    .sheet(item: $creating) { kind in
      switch kind {
      case .investment: LumpSumFormView(existing: nil)
      case .dps: DpsFormView()
      case .savings: SavingsFormView(existing: nil)
      case .emi: EmiFormView()
      }
    }
    .onChange(of: deepLink.pending) { _, link in
      guard let link else { return }
      deepLink.pending = nil
      showNotifications = false
      switch link {
      case .emi(let id):
        tab = .emis
        emisPath.append(EmiRoute(id: id))
      case .dps(let id):
        tab = .invest
        investmentsPath.append(InvestmentRoute(id: id))
      }
    }
  }
}

/// Native replacement for FabMenu: the four create flows in a grouped list,
/// presented as a medium-detent sheet from the tab bar's + slot.
struct CreateMenuSheet: View {
  @Environment(\.dismiss) private var dismiss
  let onSelect: (CreateSheet) -> Void

  var body: some View {
    NavigationStack {
      List {
        Section("New investment") {
          row(.investment)
          row(.dps)
          row(.savings)
        }
        Section("New EMI") {
          row(.emi)
        }
      }
      .navigationTitle("Create")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
      }
    }
    .presentationDetents([.medium])
  }

  private func row(_ option: CreateSheet) -> some View {
    Button {
      onSelect(option)
    } label: {
      Label(option.label, systemImage: option.symbol)
    }
  }
}

/// Greeting + name, notification bell with unread badge, avatar → Profile.
/// Kept verbatim from the Modern Noir shell — Task 3 dissolves it into the
/// Dashboard's native toolbar.
private struct HomeTopBar: View {
  @EnvironmentObject private var sync: SyncEngine
  @Query private var profiles: [Profile]
  @Query(filter: #Predicate<AppNotification> { $0.readAt == nil })
  private var unread: [AppNotification]
  @Binding var showNotifications: Bool

  private var name: String { profiles.first?.fullName ?? "" }

  private var initials: String {
    let parts = name.split(separator: " ").prefix(2)
    return parts.compactMap { $0.first }.map(String.init).joined().uppercased()
  }

  private var greeting: LocalizedStringKey {
    switch Calendar.current.component(.hour, from: Date()) {
    case ..<12: "Good morning"
    case ..<17: "Good afternoon"
    default: "Good evening"
    }
  }

  var body: some View {
    HStack {
      VStack(alignment: .leading, spacing: 0) {
        Text(greeting).font(.body).foregroundStyle(Color.onSurfaceVariant)
        Text(name).font(.displayName).foregroundStyle(Color.onSurface)
          .tracking(-0.01 * 20)
      }
      Spacer()
      HStack(spacing: 12) {
        syncBadge
        bell
        NavigationLink(value: ProfileRoute()) {
          AvatarView(initials: initials, size: 42)
        }
        .accessibilityLabel("Profile")
      }
    }
    .padding(.horizontal, Layout.screenHorizontalPadding)
    .padding(.top, 6)
    .padding(.bottom, 18)
  }

  private var bell: some View {
    Button { showNotifications = true } label: {
      Image(systemName: "bell")
        .font(.system(size: 19))
        .foregroundStyle(Color.onSurfaceVariant)
        .frame(width: 42, height: 42)
        .background(Color.brandPrimary.opacity(0.08), in: .circle)
        .overlay { Circle().strokeBorder(Color.brandPrimary.opacity(0.12), lineWidth: 0.5) }
        .overlay(alignment: .topTrailing) {
          if !unread.isEmpty {
            Text("\(unread.count)")
              .font(.custom("Manrope-Bold", size: 10))
              .foregroundStyle(Color.onHero)
              .padding(.horizontal, 4)
              .frame(minWidth: 16, minHeight: 16)
              .background(Color.tertiaryContainer, in: .capsule)
              .overlay { Capsule().strokeBorder(Color.surface, lineWidth: 1.5) }
              .offset(x: -7, y: 6)
          }
        }
        .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Notifications")
  }

  @ViewBuilder private var syncBadge: some View {
    switch sync.state {
    case .syncing: ProgressView().controlSize(.small)
    case .offline, .idle, .unauthorized: EmptyView()
    }
  }
}
```

- [ ] **Step 2: Delete the dead chrome**

```bash
rm apps/ios/Phinio/Phinio/UI/DesignSystem/NoirTabBar.swift \
   apps/ios/Phinio/Phinio/UI/DesignSystem/FabMenu.swift
```

Then in `Components+Controls.swift`, delete the entire `#Preview("Component Kit")` block (everything from `// MARK: - Preview gallery` to the end of the file) — it references `FilterPills`, `SegmentedTabs`, and other components deleted across Tasks 2–8.

Confirm nothing else references the deleted symbols:

```bash
grep -rn "NoirTabBar\|FabMenu\|fabOpen\|InactiveStack" apps/ios/Phinio/Phinio
```

Expected: no matches.

- [ ] **Step 3: Build**

Expected: `BUILD SUCCEEDED`.

- [ ] **Step 4: Unit tests**

Expected: all green.

- [ ] **Step 5: Simulator check (both appearances)**

- Native Liquid Glass tab bar with Home / Invest / EMIs and a **separated circular + slot** on the trailing edge. If the + slot renders as a magnifier or refuses the plus icon, apply the documented fallback (remove `role: .search`) and note it in the commit message.
- Tapping + opens the Create sheet at medium height; picking "DPS Scheme" switches to Invest tab and opens the DPS form; cancelling the sheet leaves the previous tab selected.
- Each tab keeps its own back stack when switching away and back.
- Deep-link smoke check: tapping a notification row that links to an EMI still navigates (EMIs tab, detail pushed).
- Detail pushes now show the tab bar at the bottom (native behavior — expected change from Modern Noir).

- [ ] **Step 6: Commit**

```bash
git add -A apps/ios/Phinio/Phinio/UI
git commit -m "✨ feat(ios): native TabView with Liquid Glass bar and create slot"
```

---
### Task 3: Home — Dashboard on List, Profile on Form, kept-leaf restyle

**Files:**
- Rewrite: `apps/ios/Phinio/Phinio/UI/Dashboard/DashboardView.swift`
- Rewrite: `apps/ios/Phinio/Phinio/UI/Dashboard/ProfileView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/MainTabView.swift` (Home tab body; delete `HomeTopBar`)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components.swift` (restyle `MoneyPill`; delete `NavRow`, `SectionLabel`)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components+Controls.swift` (restyle `AvatarView`, `IconTile`; delete `NoirToggleStyle` + its `ToggleStyle` extension)
- Modify: `apps/ios/Phinio/Phinio/UI/SharedViews.swift` (restyle `UpcomingRow`)

**Interfaces:**
- Produces: `DashboardView(showNotifications: Binding<Bool>, onCreate: (CreateSheet) -> Void)` — the notifications sheet stays in MainTabView (deep links must be able to close it), the bell button moves into Dashboard's toolbar.
- Produces (restyled, same signatures): `MoneyPill(percent: Decimal, size: Size)`, `AvatarView(initials: String, size: CGFloat)`, `IconTile(size:radius:background:icon:)` with new default `background: Color = Color(.tertiarySystemFill)`, `UpcomingRow(item: UpcomingItem)`.
- Consumes: `HeroCard`, `Gradients.netWorthHero`, `TypePalette`, `MoneyText`, `DashboardStats`, `Store` — unchanged.

- [ ] **Step 1: Restyle the kept leaves**

In `Components.swift`, replace the `MoneyPill` struct body with:

```swift
/// Gain/loss capsule. `.compact` for list rows and stat cards, `.hero` for
/// placement on gradient hero cards (white on translucent white).
struct MoneyPill: View {
  enum Size { case compact, hero }

  let percent: Decimal
  var size: Size = .compact

  private var isPositive: Bool { percent >= 0 }

  private var valueText: String {
    percent.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1))) + "%"
  }

  var body: some View {
    Text("\(isPositive ? "▲" : "▼") \(valueText)")
      .font(.caption.weight(.bold).monospacedDigit())
      .foregroundStyle(size == .hero ? Color.white : (isPositive ? Color.green : Color.red))
      .padding(.horizontal, 9)
      .padding(.vertical, size == .hero ? 4 : 3)
      .background(
        size == .hero
          ? AnyShapeStyle(.white.opacity(0.18))
          : AnyShapeStyle((isPositive ? Color.green : Color.red).opacity(0.15)),
        in: .capsule)
      .accessibilityLabel(
        Text(
          "\(isPositive ? "Up" : "Down") \(percent.magnitude.formatted(.number.precision(.fractionLength(1))))%"
        ))
  }
}
```

Also in `Components.swift`: delete the `NavRow` and `SectionLabel` structs (last consumer is the old ProfileView, rewritten this task). Leave `TypeBadge` in place but change its font line from `.font(.badgeLabel)` to `.font(.caption2.weight(.semibold))`.

In `Components+Controls.swift`:
- Delete `NoirToggleStyle` and the `extension ToggleStyle where Self == NoirToggleStyle` block (last consumer: old ProfileView).
- In `AvatarView`, replace the initials `Text` modifiers with `.font(.system(size: size * 0.35, weight: .bold))` and `.foregroundStyle(.white)`.
- In `IconTile`, change the default parameter `var background: Color = .surfaceHigh` to `var background: Color = Color(.tertiarySystemFill)`.

In `SharedViews.swift`, replace `UpcomingRow` with (padding removed — list rows provide it):

```swift
struct UpcomingRow: View {
  let item: UpcomingItem

  private var dueText: String {
    (item.sequenceNumber.map { "#\($0) · " } ?? "") + dueLabel(daysUntil: item.daysUntilDue)
  }

  var body: some View {
    HStack(spacing: 12) {
      IconTile(size: 38, radius: 11) {
        Image(systemName: item.kind == .emi ? "creditcard" : "calendar")
          .font(.system(size: 18))
          .foregroundStyle(.tint)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(item.label)
          .font(.body)
          .lineLimit(1)
        Text(dueText)
          .font(.footnote)
          .foregroundStyle(item.isOverdue ? Color.red : Color.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      MoneyText(amount: item.amount)
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .lineLimit(1)
    }
  }
}
```

- [ ] **Step 2: Rewrite DashboardView.swift**

Replace the entire file with:

```swift
import Charts
import SwiftData
import SwiftUI

struct DashboardView: View {
  @Binding var showNotifications: Bool
  /// Empty-state CTAs open the shell's create sheets.
  var onCreate: (CreateSheet) -> Void = { _ in }

  @EnvironmentObject private var sync: SyncEngine
  @Query private var profiles: [Profile]
  @Query private var investments: [Investment]
  @Query private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]
  @Query(filter: #Predicate<AppNotification> { $0.readAt == nil })
  private var unread: [AppNotification]

  /// Legend selection: nil = no focus. Tapping a row focuses its slice and dims
  /// the rest; dimmed rows stay tappable so focus can move directly; tapping the
  /// focused row again clears it.
  @State private var focusedType: String?

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var activeInvestmentCount: Int { investments.count { $0.status == "active" } }
  private var activeEmiCount: Int { emis.count { $0.status == "active" } }

  private var initials: String {
    let parts = (profiles.first?.fullName ?? "").split(separator: " ").prefix(2)
    return parts.compactMap { $0.first }.map(String.init).joined().uppercased()
  }

  private func isEmptyPortfolio(_ stats: DashboardStats) -> Bool {
    stats.invested == 0 && stats.monthlyEmiOutflow == 0
      && stats.upcoming.isEmpty && stats.allocation.isEmpty
  }

  var body: some View {
    // Computed once per body pass — the aggregation walks every model array
    // and body reads it from a dozen places.
    let stats = DashboardStats.compute(
      investments: investments, emis: emis, payments: payments,
      deposits: deposits, withdrawals: withdrawals, now: Date())
    List {
      if isEmptyPortfolio(stats) {
        emptySections
      } else {
        heroSection(stats)
        quickStats(stats)
        upcomingSection(stats)
        allocationSection(stats)
      }
    }
    .navigationTitle("Home")
    .toolbar {
      if sync.state == .syncing {
        ToolbarItem(placement: .topBarLeading) {
          ProgressView().controlSize(.small)
        }
      }
      ToolbarItem(placement: .topBarTrailing) { bell }
      ToolbarItem(placement: .topBarTrailing) {
        NavigationLink(value: ProfileRoute()) {
          AvatarView(initials: initials, size: 30)
        }
        .accessibilityLabel("Profile")
      }
    }
    .safeAreaInset(edge: .top) {
      if sync.state == .offline { OfflineBanner() }
    }
    .refreshable { await sync.syncNow() }
  }

  private var bell: some View {
    Button { showNotifications = true } label: {
      Image(systemName: "bell")
        .overlay(alignment: .topTrailing) {
          if !unread.isEmpty {
            Text("\(unread.count)")
              .font(.caption2.weight(.bold))
              .foregroundStyle(.white)
              .padding(.horizontal, 4)
              .frame(minWidth: 15, minHeight: 15)
              .background(.red, in: .capsule)
              .offset(x: 9, y: -8)
          }
        }
    }
    .accessibilityLabel("Notifications")
  }

  // MARK: - Net worth

  private func heroSection(_ stats: DashboardStats) -> some View {
    Section {
      HeroCard(
        gradient: Gradients.netWorthHero, orbTint: .white.opacity(0.14),
        orbSize: 220, orbTopOffset: -90, bottomPadding: 24
      ) {
        VStack(alignment: .leading, spacing: 0) {
          Text("Net Worth")
            .font(.caption.weight(.semibold))
            .textCase(.uppercase)
            .foregroundStyle(.white.opacity(0.72))
          MoneyText(amount: stats.netWorth)
            .font(.largeTitle.weight(.heavy).monospacedDigit())
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.top, 8)
          HStack(spacing: 8) {
            MoneyPill(percent: Decimal(stats.gainLossPercent), size: .hero)
            Text(portfolioSummary)
              .font(.footnote)
              .foregroundStyle(.white.opacity(0.72))
          }
          .padding(.top, 14)
        }
      }
    }
    .listRowInsets(EdgeInsets())
    .listRowBackground(Color.clear)
  }

  private var portfolioSummary: LocalizedStringKey {
    // `inflect:` does not pluralise the acronym "EMI"; spell both out.
    activeEmiCount == 1
      ? "^[\(activeInvestmentCount) investment](inflect: true) · 1 EMI"
      : "^[\(activeInvestmentCount) investment](inflect: true) · \(activeEmiCount) EMIs"
  }

  // MARK: - Quick stats

  private func quickStats(_ stats: DashboardStats) -> some View {
    Section {
      HStack(spacing: 12) {
        statCard("Current value") {
          MoneyText(amount: stats.current)
            .font(.title3.weight(.bold).monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        } caption: {
          MoneyPill(percent: Decimal(stats.gainLossPercent))
        }
        statCard("Monthly EMI") {
          MoneyText(amount: stats.monthlyEmiOutflow)
            .font(.title3.weight(.bold).monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        } caption: {
          Text(emiCaption).font(.caption).foregroundStyle(.secondary)
        }
      }
    }
    .listRowInsets(EdgeInsets())
    .listRowBackground(Color.clear)
  }

  private func statCard<Value: View, Caption: View>(
    _ label: LocalizedStringKey,
    @ViewBuilder value: () -> Value,
    @ViewBuilder caption: () -> Caption
  ) -> some View {
    VStack(alignment: .leading, spacing: 7) {
      Text(label).font(.footnote).foregroundStyle(.secondary)
      value()
      caption()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 20, style: .continuous))
  }

  private var emiCaption: LocalizedStringKey {
    activeEmiCount > 0 ? "across ^[\(activeEmiCount) loan](inflect: true)" : "No EMIs yet"
  }

  // MARK: - Upcoming payments

  private func upcomingSection(_ stats: DashboardStats) -> some View {
    Section {
      if stats.upcoming.isEmpty {
        Text("No payments fall in the next 30 days.")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      } else {
        ForEach(stats.upcoming) { item in
          upcomingLink(item)
        }
      }
    } header: {
      HStack {
        Text("Upcoming payments")
        Spacer()
        Text("Next 30 days")
      }
    }
  }

  // Typed NavigationLinks — a single AnyHashable-boxed value doesn't reliably
  // match the tab's typed navigationDestination(for:), so the tap would no-op.
  @ViewBuilder
  private func upcomingLink(_ item: UpcomingItem) -> some View {
    switch item.kind {
    case .emi:
      NavigationLink(value: EmiRoute(id: item.parentId)) { UpcomingRow(item: item) }
    case .deposit:
      NavigationLink(value: InvestmentRoute(id: item.parentId)) { UpcomingRow(item: item) }
    }
  }

  // MARK: - Allocation

  @ViewBuilder
  private func allocationSection(_ stats: DashboardStats) -> some View {
    if !stats.allocation.isEmpty {
      Section("Investment allocation") {
        HStack(spacing: 20) {
          allocationDonut(stats)
          VStack(spacing: 0) {
            ForEach(stats.allocation.prefix(5), id: \.type) { slice in
              legendRow(slice)
            }
          }
        }
        .padding(.vertical, 8)
      }
    }
  }

  private func allocationDonut(_ stats: DashboardStats) -> some View {
    Chart(stats.allocation, id: \.type) { slice in
      SectorMark(
        angle: .value("Value", Double(truncating: NSDecimalNumber(decimal: slice.value))),
        innerRadius: .ratio(0.733),
        angularInset: 0
      )
      .foregroundStyle(TypePalette.foreground(for: slice.type))
      .opacity(focusedType == nil || focusedType == slice.type ? 1 : 0.25)
    }
    .chartLegend(.hidden)
    .frame(width: 120, height: 120)
    .overlay {
      VStack(spacing: 0) {
        Text(focusedValue(stats).currencyCompact(currency))
          .font(.headline.monospacedDigit())
          .lineLimit(1)
          .minimumScaleFactor(0.5)
        Text(focusedType.map(investmentTypeLabel) ?? "total")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      .padding(.horizontal, 14)
    }
    .accessibilityHidden(true)  // the legend rows below carry the same data
  }

  private func focusedValue(_ stats: DashboardStats) -> Decimal {
    guard let focusedType else { return stats.current }
    return stats.allocation.first { $0.type == focusedType }?.value ?? stats.current
  }

  private func legendRow(_ slice: (type: String, value: Decimal, percent: Double)) -> some View {
    let focused = focusedType == slice.type
    return Button {
      focusedType = focused ? nil : slice.type
    } label: {
      HStack(spacing: 9) {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(TypePalette.foreground(for: slice.type))
          .frame(width: 9, height: 9)
        Text(investmentTypeLabel(slice.type))
          .font(.subheadline)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text(slice.percent.formatted(.number.precision(.fractionLength(0))) + "%")
          .font(.caption.weight(.semibold).monospacedDigit())
          .foregroundStyle(.secondary)
      }
      .frame(height: 20)
      .padding(.vertical, 4.5)
      .contentShape(.rect)
      // Dimmed rows stay tappable so focus can move straight between types.
      .opacity(focusedType == nil || focused ? 1 : 0.45)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(
      "\(investmentTypeLabel(slice.type)), \(slice.percent.formatted(.number.precision(.fractionLength(0)))) percent"
    )
    .accessibilityAddTraits(focused ? [.isButton, .isSelected] : .isButton)
  }

  // MARK: - Empty state

  @ViewBuilder
  private var emptySections: some View {
    Section {
      ContentUnavailableView(
        "Welcome to Phinio", systemImage: "chart.pie",
        description: Text("Add your first investment or EMI to see your dashboard."))
        .listRowBackground(Color.clear)
    }
    Section {
      ctaRow(
        title: "Add your first investment",
        message: "Track stocks, gold, DPS schemes and savings pots.",
        symbol: "chart.line.uptrend.xyaxis", sheet: .investment)
      ctaRow(
        title: "Add your first EMI",
        message: "Generate a full amortization schedule up front.",
        symbol: "creditcard", sheet: .emi)
    }
  }

  private func ctaRow(
    title: LocalizedStringKey, message: LocalizedStringKey, symbol: String, sheet: CreateSheet
  ) -> some View {
    Button { onCreate(sheet) } label: {
      HStack(spacing: 12) {
        IconTile(size: 38, radius: 11) {
          Image(systemName: symbol).font(.system(size: 18)).foregroundStyle(.tint)
        }
        VStack(alignment: .leading, spacing: 2) {
          Text(title).font(.body).foregroundStyle(.primary)
          Text(message).font(.caption).foregroundStyle(.secondary)
        }
      }
    }
  }
}
```

- [ ] **Step 3: Update MainTabView's Home tab and delete HomeTopBar**

In `MainTabView.swift`, replace the Home `Tab` block with:

```swift
      Tab("Home", systemImage: "house", value: AppTab.home) {
        NavigationStack(path: $homePath) {
          DashboardView(showNotifications: $showNotifications) { creating = $0 }
            .navigationDestination(for: EmiRoute.self) { EmiDetailView(emiId: $0.id) }
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
            .navigationDestination(for: ProfileRoute.self) { _ in ProfileView() }
            .navigationDestination(for: ActivityRoute.self) { _ in ActivityView() }
        }
      }
```

Then delete the entire `private struct HomeTopBar` from the bottom of the file. The offline banner now lives in DashboardView's `safeAreaInset` (Step 2), the greeting is gone (the large title + avatar carry identity), and the sync spinner/bell/avatar live in the toolbar.

- [ ] **Step 4: Rewrite ProfileView.swift**

Replace the entire file with (all actions — `saveName`, `save(currency:language:)`, `openSettings`, `refreshNotifStatus`, `signOut` — are byte-identical to the old file):

```swift
import SwiftData
import SwiftUI
import UIKit
import UserNotifications

struct ProfileView: View {
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @Query private var profiles: [Profile]
  @Query(sort: \SyncIssue.occurredAt, order: .reverse)
  private var issues: [SyncIssue]

  @State private var fullName = ""
  @State private var notifStatus: UNAuthorizationStatus = .notDetermined
  @State private var confirmSignOut = false
  @State private var seeded = false

  private var profile: Profile? { profiles.first }
  private var currency: String { profile?.preferredCurrency ?? "BDT" }
  private var language: String { profile?.preferredLanguage ?? "en" }

  private var initials: String {
    let parts = (profile?.fullName ?? "").split(separator: " ").prefix(2)
    return parts.compactMap { $0.first }.map(String.init).joined().uppercased()
  }

  private var nameIsValid: Bool {
    Validate.name(fullName, min: 2) != nil
  }

  var body: some View {
    Form {
      Section {
        VStack(spacing: 12) {
          AvatarView(initials: initials, size: 88)
          TextField("Full name", text: $fullName)
            .font(.title3.weight(.semibold))
            .multilineTextAlignment(.center)
            .textContentType(.name)
            .submitLabel(.done)
            .onSubmit(saveName)
        }
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
      } footer: {
        if !nameIsValid {
          Text("Name needs at least 2 characters.")
        }
      }

      Section {
        Picker("Currency", selection: currencyBinding) {
          Text("৳ BDT").tag("BDT")
          Text("$ USD").tag("USD")
        }
        Picker("Language", selection: languageBinding) {
          Text("English").tag("en")
          Text("বাংলা").tag("bn")
        }
        Toggle("Payment reminders", isOn: remindersBinding)
      } header: {
        Text("Preferences")
      } footer: {
        Text(reminderHelp)
      }

      Section("Account") {
        NavigationLink(value: ActivityRoute()) {
          Text("Activity history")
        }
        Button {
          Task { await sync.syncNow() }
        } label: {
          LabeledContent("Sync now") {
            Text(String(describing: sync.state).capitalized)
          }
        }
        .foregroundStyle(.primary)
        Button("Sign out", role: .destructive) { confirmSignOut = true }
      }

      if !issues.isEmpty {
        Section {
          ForEach(issues) { issue in
            VStack(alignment: .leading, spacing: 2) {
              Text(issue.message)
                .font(.subheadline)
              Text(issue.occurredAt, format: .relative(presentation: .named))
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .swipeActions {
              Button("Dismiss", role: .destructive) {
                context.delete(issue)
                try? context.save()
              }
            }
          }
        } header: {
          Text("Sync issues")
        } footer: {
          Text("These changes were rejected by the server and undone by the last sync.")
        }
      }
    }
    .navigationTitle("Profile")
    .navigationBarTitleDisplayMode(.inline)
    // Seed exactly once, when the profile first becomes available — @Query
    // loads async, so it may arrive after the view appears.
    .onChange(of: profile?.id, initial: true) { _, _ in
      guard !seeded, let p = profile else { return }
      seeded = true
      fullName = p.fullName
    }
    .task { await refreshNotifStatus() }
    .confirmationDialog(
      "Sign out? Local data on this device will be erased.",
      isPresented: $confirmSignOut, titleVisibility: .visible
    ) {
      Button("Sign out", role: .destructive) { signOut() }
    }
  }

  // MARK: Bindings

  /// Currency and language apply immediately — every formatted amount
  /// re-renders from the profile, so there is nothing to "save".
  private var currencyBinding: Binding<String> {
    Binding(get: { currency }, set: { save(currency: $0, language: language) })
  }

  private var languageBinding: Binding<String> {
    Binding(get: { language }, set: { save(currency: currency, language: $0) })
  }

  /// iOS cannot revoke authorization programmatically, so switching off an
  /// authorized toggle — like switching on a denied one — hands off to Settings.
  private var remindersBinding: Binding<Bool> {
    Binding(
      get: { notifStatus == .authorized || notifStatus == .provisional },
      set: { wantsOn in
        switch notifStatus {
        case .notDetermined where wantsOn:
          Task {
            await PushManager.requestAndRegister()
            await refreshNotifStatus()
          }
        default:
          openSettings()
        }
      })
  }

  private var reminderHelp: String {
    switch notifStatus {
    case .authorized, .provisional:
      "Reminders on — we'll nudge you before each due date."
    case .denied:
      "Notifications are off in iOS Settings."
    default:
      "Turn on to get a heads-up before payments are due."
    }
  }

  // MARK: Actions

  private func saveName() {
    guard let p = profile, nameIsValid else { return }
    try? Store(context: context).updateProfile(
      p, fullName: fullName.trimmingCharacters(in: .whitespaces),
      preferredCurrency: p.preferredCurrency, preferredLanguage: p.preferredLanguage)
    Task { await sync.syncNow() }
  }

  private func save(currency: String, language: String) {
    guard let p = profile else { return }
    try? Store(context: context).updateProfile(
      p, fullName: p.fullName, preferredCurrency: currency, preferredLanguage: language)
    Task { await sync.syncNow() }
  }

  private func openSettings() {
    if let url = URL(string: UIApplication.openSettingsURLString) {
      UIApplication.shared.open(url)
    }
  }

  private func refreshNotifStatus() async {
    notifStatus = await UNUserNotificationCenter.current()
      .notificationSettings().authorizationStatus
  }

  private func signOut() {
    // Best-effort server-side device-token removal before the token dies.
    if let token = PushManager.deviceTokenForLogout {
      let client = APIClient()
      Task.detached {
        try? await client.post(
          path: "/api/v1/device-tokens/\(token)", body: nil,
          method: "DELETE", idempotencyKey: UUID())
      }
    }
    auth.signOut(container: context.container)
  }
}
```

Deliberate behavior change to note in the commit: name edits save on keyboard submit (native pattern) instead of the pencil/Cancel/Save trio; the invalid-name hint renders as a section footer.

- [ ] **Step 5: Confirm the deletions left no danglers**

```bash
grep -rn "NavRow\|SectionLabel\|NoirToggle\|HomeTopBar\|\.noir\b" apps/ios/Phinio/Phinio
```

Expected: no matches (`.noirForm`/`.noirFormRow` still exist — the pattern above only catches `.noir` as a whole word).

- [ ] **Step 6: Build + unit tests**

Both commands from the header. Expected: `BUILD SUCCEEDED`, all tests green.

- [ ] **Step 7: Simulator check (both appearances)**

- Home is an inset-grouped List with a large "Home" title; bell (with unread badge) and avatar in the nav bar; pull-to-refresh syncs.
- Net-worth hero: gradient card, white text, legible in both appearances. NOTE: `.listRowInsets(EdgeInsets())` removes the ROW's padding but NOT the inset-grouped section margin, so the hero sits at the same ~16pt inset as the cards below rather than bleeding to the screen edge. That is correct and looks intentional — it keeps the card rhythm. Do not add a `.listStyle()` change or negative padding to force true edge-to-edge.
- Quick stats: two rounded cards side by side; money is monospaced; light mode uses light card surfaces.
- Upcoming payments rows navigate to details; overdue rows show red dates.
- Allocation donut + legend: tap a legend row to focus a slice, tap again to clear; colors readable in light mode (this is the first live check of the light TypePalette).
- Profile: native Form — avatar header, name TextField saves on return, Currency/Picker + Language/Picker apply immediately (check a money value re-renders after switching currency), reminders toggle behaves per permission state, Sign out confirms destructively, sync issues section (if any) swipes to dismiss.
- Empty-portfolio state (fresh install): welcome + two CTA rows open the right create sheets.

- [ ] **Step 8: Commit**

```bash
git add -A apps/ios/Phinio/Phinio/UI
git commit -m "💄 style(ios): Home dashboard on native List, Profile on Form"
```

---
### Task 4: Invest — list screen, three forms, withdraw sheet

**Files:**
- Rewrite: `apps/ios/Phinio/Phinio/UI/Investments/InvestmentsListView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Investments/LumpSumFormView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Investments/DpsFormView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Investments/SavingsFormView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Investments/WithdrawSheet.swift`

**Interfaces:**
- Consumes: `TypeBadge(type:)`, `MoneyText(amount:)`, `InvestmentRoute`, `Validate`, `Store`, `Money.string`, `investmentTypeLabel(_:)` — unchanged.
- Produces: `InvestmentDetailRouter(investmentId:)` — kept verbatim at the bottom of InvestmentsListView.swift (Task 5's detail views depend on it).
- Form view signatures unchanged: `LumpSumFormView(existing: Investment?)`, `DpsFormView()`, `SavingsFormView(existing: Investment?)`, `WithdrawSheet(investment: Investment)`.

- [ ] **Step 1: Rewrite InvestmentsListView.swift**

Replace the entire file with (filtering/summary logic and `InvestmentDetailRouter` are byte-identical to the old file; the old screen-title header and its "N active · M completed" count line are replaced by the large nav title — the segmented control already communicates status):

```swift
import SwiftData
import SwiftUI

struct InvestmentsListView: View {
  @Query(sort: \Investment.updatedAt, order: .reverse)
  private var investments: [Investment]
  @Query private var deposits: [InvestmentDeposit]
  @Query private var profiles: [Profile]

  @State private var statusIndex = 0  // 0 = Active, 1 = Completed
  @State private var typeIndex = 0  // 0 = All

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var showCompleted: Bool { statusIndex == 1 }

  // Web filter: active = ['active']; completed = ['completed','matured','closed']
  private var byStatus: [Investment] {
    investments.filter { showCompleted ? $0.status != "active" : $0.status == "active" }
  }

  /// Filter options are derived from the types actually present, so no option
  /// ever filters to an empty list. "All" is always first.
  private var pillTypes: [String] {
    var seen: [String] = []
    for inv in byStatus where !seen.contains(inv.type) { seen.append(inv.type) }
    return seen.sorted { investmentTypeLabel($0) < investmentTypeLabel($1) }
  }

  private var pillTitles: [String] { ["All"] + pillTypes.map(investmentTypeLabel) }

  private var filtered: [Investment] {
    guard typeIndex > 0, typeIndex <= pillTypes.count else { return byStatus }
    let type = pillTypes[typeIndex - 1]
    return byStatus.filter { $0.type == type }
  }

  // Summary covers all three modes, active only — matches the dashboard's basis.
  private var activeInvestments: [Investment] { investments.filter { $0.status == "active" } }
  private var totalInvested: Decimal { activeInvestments.reduce(0) { $0 + $1.investedAmount } }
  private var totalCurrent: Decimal { activeInvestments.reduce(0) { $0 + $1.currentValue } }
  private var returnPercent: Decimal? {
    guard totalInvested > 0 else { return nil }
    return (totalCurrent - totalInvested) / totalInvested * 100
  }

  var body: some View {
    List {
      Section {
        Picker("Status", selection: $statusIndex) {
          Text("Active").tag(0)
          Text("Completed").tag(1)
        }
        .pickerStyle(.segmented)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .onChange(of: statusIndex) { _, _ in typeIndex = 0 }
      }

      Section { summaryRow }

      if filtered.isEmpty {
        Section {
          ContentUnavailableView(
            "Nothing here yet",
            systemImage: "chart.line.uptrend.xyaxis",
            description: Text(
              showCompleted
                ? "No completed investments match this filter."
                : "No investments match this filter."))
            .listRowBackground(Color.clear)
        }
      } else {
        Section {
          ForEach(filtered) { inv in
            NavigationLink(value: InvestmentRoute(id: inv.id)) {
              InvestmentRow(
                investment: inv, deposits: deposits(for: inv), currency: currency)
            }
          }
        }
      }
    }
    .navigationTitle("Investments")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Picker("Type", selection: $typeIndex) {
            ForEach(Array(pillTitles.enumerated()), id: \.offset) { i, title in
              Text(title).tag(i)
            }
          }
        } label: {
          Label(
            "Filter by type",
            systemImage: typeIndex == 0
              ? "line.3.horizontal.decrease.circle"
              : "line.3.horizontal.decrease.circle.fill")
        }
      }
    }
  }

  private func deposits(for inv: Investment) -> [InvestmentDeposit] {
    deposits.filter { $0.investmentId == inv.id }
  }

  private var summaryRow: some View {
    HStack(spacing: 0) {
      // Compact figures — full precision just forces every column to shrink.
      summaryColumn("Invested", totalInvested.currencyCompact(currency), .primary)
      Divider()
      summaryColumn("Value", totalCurrent.currencyCompact(currency), .primary)
      Divider()
      summaryColumn(
        "Return",
        returnPercent.map {
          $0.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1))) + "%"
        } ?? "—",
        (returnPercent ?? 0) >= 0 ? Color.green : Color.red)
    }
    .padding(.vertical, 6)
  }

  private func summaryColumn(
    _ label: LocalizedStringKey, _ value: String, _ tint: Color
  ) -> some View {
    VStack(spacing: 5) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value)
        .font(.headline.monospacedDigit())
        .foregroundStyle(tint)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .combine)
  }
}

/// One row per investment, switched on `mode`. Lump-sum, DPS and savings each
/// surface different figures.
private struct InvestmentRow: View {
  let investment: Investment
  let deposits: [InvestmentDeposit]
  let currency: String

  private var paidCount: Int { deposits.count { $0.status == "paid" } }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 10) {
        Text(investment.name)
          .font(.headline)
          .lineLimit(1)
        Spacer(minLength: 0)
        TypeBadge(type: investment.type)
      }
      switch investment.mode {
      case "scheduled": dpsBody
      case "flexible": savingsBody
      default: lumpBody
      }
    }
    .padding(.vertical, 4)
  }

  // MARK: Lump sum

  private var lumpBody: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .bottom) {
        figure(
          "Invested", investment.investedAmount.currency(currency),
          font: .subheadline.monospacedDigit(), tint: .secondary)
        Spacer()
        figure(
          investment.status == "active" ? "Current value" : "Exit value",
          (investment.exitValue ?? investment.currentValue).currency(currency),
          font: .title3.weight(.bold).monospacedDigit(), tint: .primary,
          alignment: .trailing)
      }
      .padding(.top, 12)

      HStack {
        if let date = investment.dateOfInvestment {
          Text(date, format: .dateTime.day().month(.abbreviated).year())
            .font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        if let pct = returnPercent { MoneyPill(percent: pct) }
      }
      .padding(.top, 10)
    }
  }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    let value = investment.exitValue ?? investment.currentValue
    return (value - investment.investedAmount) / investment.investedAmount * 100
  }

  // MARK: DPS

  private var dpsBody: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .bottom) {
        figure(
          "Deposited", investment.investedAmount.currency(currency),
          font: .title3.weight(.bold).monospacedDigit(), tint: .primary)
        Spacer()
        figure(
          "Maturity", maturityLabel,
          font: .subheadline.monospacedDigit(), tint: .green, alignment: .trailing)
      }
      .padding(.top, 12)

      ProgressView(
        value: progress
      ) {
        Text("\(paidCount) / \(investment.tenureMonths ?? deposits.count) months")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
      }
      .tint(.green)
      .padding(.top, 10)

      HStack {
        if let monthly = investment.monthlyDeposit {
          Text(monthly.currency(currency) + "/mo")
        }
        Spacer()
        if let rate = investment.interestRate {
          Text(rate.formatted(.number.precision(.fractionLength(0))) + "% p.a.")
        }
        Spacer()
        if let next = nextDue {
          Text("Next ") + Text(next, format: .dateTime.day().month(.abbreviated))
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
      .padding(.top, 10)
    }
  }

  /// Maturity is the last installment's accrued value — server-computed, since
  /// deriving it on-device would mean re-implementing the schedule. Shows a
  /// placeholder until the first sync populates it.
  private var maturityLabel: String {
    guard let accrued = deposits
      .sorted(by: { ($0.installmentNumber ?? 0) < ($1.installmentNumber ?? 0) })
      .last?.accruedValue
    else { return "—" }
    return accrued.currency(currency)
  }

  private var progress: Double {
    let total = investment.tenureMonths ?? deposits.count
    guard total > 0 else { return 0 }
    return Double(paidCount) / Double(total)
  }

  private var nextDue: Date? {
    deposits.filter { $0.status != "paid" }.compactMap(\.dueDate).min()
  }

  // MARK: Savings

  private var savingsBody: some View {
    HStack(alignment: .bottom) {
      VStack(alignment: .leading, spacing: 5) {
        Text("^[\(deposits.count) deposit](inflect: true)")
          .font(.caption).foregroundStyle(.secondary)
        Text("Deposited \(investment.investedAmount.currency(currency))")
          .font(.caption).foregroundStyle(.secondary)
      }
      Spacer()
      figure(
        "Balance", investment.currentValue.currency(currency),
        font: .title3.weight(.bold).monospacedDigit(), tint: .primary,
        alignment: .trailing)
    }
    .padding(.top, 12)
  }

  // MARK: Shared

  private func figure(
    _ label: LocalizedStringKey, _ value: String, font: Font, tint: Color,
    alignment: HorizontalAlignment = .leading
  ) -> some View {
    VStack(alignment: alignment, spacing: 3) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value).font(font).foregroundStyle(tint).lineLimit(1).minimumScaleFactor(0.6)
    }
    .accessibilityElement(children: .combine)
  }
}

/// Detail dispatch by mode. Detail views take an id and re-query so a
/// deep link works and deletion pops gracefully.
struct InvestmentDetailRouter: View {
  let investmentId: String
  @Query private var matches: [Investment]

  init(investmentId: String) {
    self.investmentId = investmentId
    _matches = Query(filter: #Predicate<Investment> { $0.id == investmentId })
  }

  var body: some View {
    if let inv = matches.first {
      switch inv.mode {
      case "flexible": SavingsDetailView(investment: inv)
      case "scheduled": DpsDetailView(investment: inv)
      default: LumpSumDetailView(investment: inv)
      }
    } else {
      EmptyStateView(symbol: "questionmark.circle", title: "Not found",
        message: "This investment is no longer on this device.")
    }
  }
}
```

Note: `figure(_:_:...)` label changed from `String` to `LocalizedStringKey` — all call sites pass literals, so nothing else changes.

- [ ] **Step 2: Strip Modern Noir styling from the three forms + withdraw sheet**

The four files are already native `Form`s — only the noir dressing goes. Apply the identical recipe to `LumpSumFormView.swift`, `DpsFormView.swift`, `SavingsFormView.swift`, `WithdrawSheet.swift`:

1. Delete every `.noirFormRow()` line.
2. Delete the `.noirForm()` line.
3. Replace every `Text(error).foregroundStyle(Color.error)` with `Text(error).foregroundStyle(.red)`.

In `DpsFormView.swift` only, this leaves the `Section("Preview")` block reading:

```swift
        if let total = totalDeposits {
          Section("Preview") {
            LabeledContent("Total deposits") { MoneyText(amount: total) }
            LabeledContent("Over") { Text("\(tenureMonths) months") }
          }
        }
```

- [ ] **Step 3: Build + unit tests**

Expected: `BUILD SUCCEEDED`, all green. Also confirm no invest-form noir refs remain:

```bash
grep -rn "noirForm\|Color.error" apps/ios/Phinio/Phinio/UI/Investments
```

Expected: matches only in the three detail views (converted in Task 5).

- [ ] **Step 4: Simulator check (both appearances)**

- Invest tab: large "Investments" title, segmented Active/Completed, filter menu in the toolbar (icon fills when a type filter is active), summary row with three columns, native rows with type badges and chevrons. Switching status resets the type filter.
- DPS rows show a native progress bar tinted green with "n / m months" label.
- All four sheets (new investment, new DPS, new savings from the + slot; withdraw from a detail once Task 5 lands — for now trigger forms only) are plain native Forms with Cancel/Save in the nav bar, correct validation-disabled Save, and system light/dark surfaces.

- [ ] **Step 5: Commit**

```bash
git add -A apps/ios/Phinio/Phinio/UI/Investments
git commit -m "💄 style(ios): Investments list on native List, forms de-noired"
```

---

### Task 5: Invest — three detail screens

**Files:**
- Rewrite: `apps/ios/Phinio/Phinio/UI/Investments/LumpSumDetailView.swift`
- Rewrite: `apps/ios/Phinio/Phinio/UI/Investments/DpsDetailView.swift` (includes `DpsEditSheet`, `DpsCloseSheet`)
- Rewrite: `apps/ios/Phinio/Phinio/UI/Investments/SavingsDetailView.swift` (includes `AddDepositSheet`)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components.swift` (restyle `StatTile`)

**Interfaces:**
- Produces: `StatTile(label: String, value: String, alignment: HorizontalAlignment = .center)` — the `valueFont` parameter is **removed**; the EMI detail (Task 6) uses this new signature.
- Consumes: `HeroCard(gradient:orbTint:radius:...)` with literal `radius: 20`, `Gradients.netWorthHero/.dpsHero/.savingsHero`, `MoneyPill`, `TypeBadge`, `IconTile`, `Store`, `Validate`, `utcDaysUntil` — unchanged.
- Detail view signatures unchanged: `LumpSumDetailView(investment:)`, `DpsDetailView(investment:)`, `SavingsDetailView(investment:)`.

- [ ] **Step 1: Restyle StatTile**

In `Components.swift`, replace the `StatTile` struct with:

```swift
/// Grid tile (3-up on EMI/DPS detail, 2-up on Savings detail).
struct StatTile: View {
  let label: String
  let value: String
  var alignment: HorizontalAlignment = .center

  var body: some View {
    VStack(alignment: alignment, spacing: 4) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value)
        .font(.headline.monospacedDigit())
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    .padding(.vertical, 12)
    .padding(.horizontal, 10)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}
```

- [ ] **Step 2: Rewrite LumpSumDetailView.swift**

Replace the entire file with (the old StatTile trio duplicated the detail rows — the native version keeps only `LabeledContent` rows; edit/withdraw/delete move behind the toolbar per spec §2):

```swift
import SwiftData
import SwiftUI

struct LumpSumDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var withdrawals: [InvestmentWithdrawal]
  @Query private var profiles: [Profile]
  @State private var editing = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var value: Decimal { investment.exitValue ?? investment.currentValue }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    return (value - investment.investedAmount) / investment.investedAmount * 100
  }

  var body: some View {
    List {
      Section {
        hero
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        LabeledContent("Invested") {
          MoneyText(amount: investment.investedAmount)
            .monospacedDigit()
        }
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Type") { TypeBadge(type: investment.type) }
        if let date = investment.dateOfInvestment {
          LabeledContent("Invested on") {
            Text(date, format: .dateTime.day().month(.wide).year())
          }
        }
        if let closure = investment.estimatedClosureDate {
          LabeledContent("Estimated closure") {
            Text(closure, format: .dateTime.day().month(.wide).year())
          }
        }
        if let notes = investment.notes, !notes.isEmpty {
          LabeledContent("Notes") { Text(notes) }
        }
      }

      if !withdrawals.isEmpty {
        Section("Withdrawals") {
          ForEach(withdrawals) { w in
            WithdrawalRow(withdrawal: w, currency: currency)
          }
        }
      }
    }
    .navigationTitle(investment.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
          if investment.status == "active" {
            Button { withdrawing = true } label: {
              Label("Withdraw", systemImage: "arrow.up.circle")
            }
          }
          Button(role: .destructive) { confirmDelete = true } label: {
            Label("Delete investment", systemImage: "trash")
          }
        } label: {
          Label("More", systemImage: "ellipsis.circle")
        }
      }
    }
    .sheet(isPresented: $editing) { LumpSumFormView(existing: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog(
      "Delete this investment?", isPresented: $confirmDelete, titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }

  private var hero: some View {
    HeroCard(
      gradient: Gradients.netWorthHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text(investment.exitValue == nil ? "Current Value" : "Exit Value")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.72))
        Text(value.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        if let pct = returnPercent {
          MoneyPill(percent: pct, size: .hero).padding(.top, 10)
        }
      }
    }
  }
}

/// Shared by LumpSumDetailView and SavingsDetailView.
struct WithdrawalRow: View {
  let withdrawal: InvestmentWithdrawal
  let currency: String

  var body: some View {
    HStack(spacing: 12) {
      IconTile(size: 38, radius: 11, background: Color.red.opacity(0.12)) {
        Image(systemName: "arrow.up")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(.red)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(withdrawal.notes ?? "Withdrawal")
          .font(.body).lineLimit(1)
        Text(withdrawal.withdrawalDate, format: .dateTime.day().month(.abbreviated).year())
          .font(.caption).foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      Text("− " + withdrawal.amount.currency(currency))
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .foregroundStyle(.red)
        .lineLimit(1).minimumScaleFactor(0.6)
    }
  }
}
```

- [ ] **Step 3: Rewrite DpsDetailView.swift**

Replace the entire file with (schedule tap-to-toggle behavior, maturity/interest derivations, and both sheets' logic unchanged; header actions move to a toolbar Menu; the interest/rate subtitle becomes a `LabeledContent` row):

```swift
import SwiftData
import SwiftUI

struct DpsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @Query private var profiles: [Profile]
  @State private var editing = false
  @State private var closing = false
  @State private var confirmDelete = false
  @State private var error: String?

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.installmentNumber)])
  }

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var paidCount: Int { deposits.count { $0.status == "paid" } }
  private var tenure: Int { investment.tenureMonths ?? deposits.count }

  /// Maturity and interest come off the server-computed `accruedValue`; the
  /// schedule is server-generated, so deriving them here would mean
  /// re-implementing it. Nil until the first sync.
  private var maturity: Decimal? { deposits.last?.accruedValue }
  private var interestEarned: Decimal? {
    // Accrued through the leading contiguous paid run minus deposits over that
    // run — out-of-order paid installments don't advance the figure.
    let contiguousPaid = deposits.prefix { $0.status == "paid" }.count
    guard contiguousPaid > 0,
          let accrued = deposits[contiguousPaid - 1].accruedValue else { return nil }
    return max(0, accrued - Decimal(contiguousPaid) * (investment.monthlyDeposit ?? 0))
  }

  private var interestLine: String? {
    guard let rate = investment.interestRate else { return nil }
    let pct = rate.formatted(.number.precision(.fractionLength(0))) + "% p.a."
    guard let type = investment.interestType else { return pct }
    return "\(type.capitalized) · \(pct)"
  }

  var body: some View {
    List {
      Section {
        hero
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        HStack(spacing: 10) {
          StatTile(
            label: "Monthly deposit",
            value: (investment.monthlyDeposit ?? 0).currencyCompact(currency))
          StatTile(
            label: "Maturity value",
            value: maturity?.currencyCompact(currency) ?? "—")
          StatTile(
            label: "Interest earned",
            value: interestEarned?.currencyCompact(currency) ?? "—")
        }
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      if let interestLine {
        Section {
          LabeledContent("Interest") { Text(interestLine) }
        }
      }

      Section("Deposit schedule") {
        if let error {
          Text(error).font(.footnote).foregroundStyle(.red)
        }
        if deposits.isEmpty {
          Text("Schedule appears after first sync")
            .font(.subheadline).foregroundStyle(.secondary)
        }
        ForEach(deposits) { scheduleRow($0) }
      }
    }
    .navigationTitle(investment.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
          if investment.status == "active" {
            Button { closing = true } label: {
              Label("Close early", systemImage: "xmark.circle")
            }
          }
          Button(role: .destructive) { confirmDelete = true } label: {
            Label("Delete DPS scheme", systemImage: "trash")
          }
        } label: {
          Label("More", systemImage: "ellipsis.circle")
        }
      }
    }
    .sheet(isPresented: $editing) { DpsEditSheet(investment: investment) }
    .sheet(isPresented: $closing) { DpsCloseSheet(investment: investment) }
    .confirmationDialog(
      "Delete this scheme and its schedule?", isPresented: $confirmDelete,
      titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }

  private var hero: some View {
    HeroCard(
      gradient: Gradients.dpsHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Total Deposited")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.72))
        Text(investment.investedAmount.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        Text("\(paidCount) / \(tenure) months")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.white.opacity(0.75))
          .padding(.top, 14)
        // In-hero bar stays white-on-white — the tinted system bar would
        // vanish on the gradient.
        Capsule()
          .fill(.white.opacity(0.2))
          .frame(height: 6)
          .overlay(alignment: .leading) {
            GeometryReader { geo in
              Capsule()
                .fill(.white)
                .frame(width: geo.size.width * (tenure > 0 ? Double(paidCount) / Double(tenure) : 0))
            }
          }
          .padding(.top, 8)
      }
    }
  }

  private func scheduleRow(_ dep: InvestmentDeposit) -> some View {
    let paid = dep.status == "paid"
    let overdue = !paid && dep.dueDate.map { utcDaysUntil($0, from: Date()) < 0 } ?? false
    let canToggle = investment.status == "active" || investment.status == "matured"
    return Button {
      guard canToggle else { return }
      do {
        try Store(context: context).markDepositPaid(dep, investment: investment, paid: !paid)
        error = nil
        Task { await sync.syncNow() }
      } catch {
        self.error = error.localizedDescription
      }
    } label: {
      HStack(spacing: 12) {
        Text("\(dep.installmentNumber ?? 0)")
          .font(.caption.weight(.bold).monospacedDigit())
          .foregroundStyle(.secondary)
          .frame(width: 30, alignment: .leading)
        VStack(alignment: .leading, spacing: 2) {
          Text(dep.amount.currency(currency))
            .font(.body.monospacedDigit())
          Text(rowSubtitle(dep))
            .font(.caption)
            .foregroundStyle(overdue ? Color.red : Color.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        checkbox(paid)
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .disabled(!canToggle)
    .accessibilityLabel("Installment \(dep.installmentNumber ?? 0), \(dep.amount.currency(currency))")
    .accessibilityValue(paid ? "Paid" : overdue ? "Overdue" : "Upcoming")
  }

  private func rowSubtitle(_ dep: InvestmentDeposit) -> String {
    var parts: [String] = []
    if let due = dep.dueDate {
      parts.append(due.formatted(.dateTime.month(.abbreviated).year(.twoDigits)))
    }
    if let accrued = dep.accruedValue {
      parts.append("bal \(accrued.currencyCompact(currency))")
    }
    return parts.joined(separator: " · ")
  }

  private func checkbox(_ paid: Bool) -> some View {
    Image(systemName: paid ? "checkmark.circle.fill" : "circle")
      .font(.title3)
      .foregroundStyle(paid ? Color.green : Color(.separator))
      .accessibilityHidden(true)
  }
}

struct DpsEditSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var name = ""
  @State private var notes = ""

  var body: some View {
    NavigationStack {
      Form {
        TextField("Name", text: $name)
        TextField("Notes", text: $notes, axis: .vertical)
      }
      .navigationTitle("Edit DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            try? Store(context: context).updateDps(
              investment, name: Validate.name(name)!,
              notes: Validate.notes(notes)!)
            Task { await sync.syncNow() }
            dismiss()
          }
          .disabled(Validate.name(name) == nil || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        name = investment.name
        notes = investment.notes ?? ""
      }
    }
    .presentationDetents([.medium, .large])
  }
}

struct DpsCloseSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var receivedAmount = ""
  @State private var closureDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Amount received", text: $receivedAmount)
            .keyboardType(.decimalPad)
          DatePicker("Closure date", selection: $closureDate,
                     displayedComponents: .date)
          TextField("Notes", text: $notes, axis: .vertical)
        } footer: {
          Text("Premature closure removes remaining installments. This can't be undone locally.")
        }
        if let error { Section { Text(error).foregroundStyle(.red) } }
      }
      .navigationTitle("Close DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Close DPS", role: .destructive) { submit() }
            .disabled(Validate.positiveMoney(receivedAmount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
    .presentationDetents([.medium, .large])
  }

  private func submit() {
    do {
      try Store(context: context).closeDps(
        investment, receivedAmount: Validate.positiveMoney(receivedAmount)!,
        closureDate: closureDate, notes: Validate.notes(notes, max: 500)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

- [ ] **Step 4: Rewrite SavingsDetailView.swift**

Replace the entire file with (add-deposit/withdraw become labeled Button rows — primary actions stay visible, destructive delete goes behind the Menu; `WithdrawalRow` comes from Step 2):

```swift
import SwiftData
import SwiftUI

struct SavingsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]
  @Query private var profiles: [Profile]
  @State private var editing = false
  @State private var addingDeposit = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.depositDate, order: .reverse)])
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    return (investment.currentValue - investment.investedAmount)
      / investment.investedAmount * 100
  }

  var body: some View {
    List {
      Section {
        hero
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        HStack(spacing: 10) {
          StatTile(
            label: "Total deposited",
            value: investment.investedAmount.currencyCompact(currency),
            alignment: .leading)
          StatTile(
            label: "Deposits", value: "\(deposits.count)",
            alignment: .leading)
        }
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      if investment.status == "active" {
        Section {
          Button { addingDeposit = true } label: {
            Label("Add deposit", systemImage: "plus.circle")
          }
          Button { withdrawing = true } label: {
            Label("Withdraw", systemImage: "arrow.up.circle")
          }
        }
      }

      Section("Deposit history") {
        if deposits.isEmpty {
          Text("No deposits yet")
            .font(.subheadline).foregroundStyle(.secondary)
        }
        ForEach(deposits) { dep in
          depositRow(dep)
            .swipeActions {
              if investment.status == "active" {
                Button("Remove", role: .destructive) {
                  try? Store(context: context).removeDeposit(dep, from: investment)
                  Task { await sync.syncNow() }
                }
              }
            }
        }
      }

      if !withdrawals.isEmpty {
        Section("Withdrawals") {
          ForEach(withdrawals) { w in
            WithdrawalRow(withdrawal: w, currency: currency)
          }
        }
      }
    }
    .navigationTitle(investment.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
          Button(role: .destructive) { confirmDelete = true } label: {
            Label("Delete savings pot", systemImage: "trash")
          }
        } label: {
          Label("More", systemImage: "ellipsis.circle")
        }
      }
    }
    .sheet(isPresented: $editing) { SavingsFormView(existing: investment) }
    .sheet(isPresented: $addingDeposit) { AddDepositSheet(investment: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog("Delete this savings?", isPresented: $confirmDelete,
                        titleVisibility: .visible) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }

  private var hero: some View {
    HeroCard(
      gradient: Gradients.savingsHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Current Balance")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.72))
        Text(investment.currentValue.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        if let pct = returnPercent, !deposits.isEmpty {
          MoneyPill(percent: pct, size: .hero).padding(.top, 12)
        }
      }
    }
  }

  private func depositRow(_ dep: InvestmentDeposit) -> some View {
    HStack(spacing: 12) {
      IconTile(size: 38, radius: 11, background: Color.green.opacity(0.12)) {
        Image(systemName: "arrow.down")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(.green)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(dep.notes ?? "Deposit")
          .font(.body).lineLimit(1)
        if let d = dep.depositDate {
          Text(d, format: .dateTime.day().month(.abbreviated).year())
            .font(.caption).foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      Text("+ " + dep.amount.currency(currency))
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .foregroundStyle(.green)
        .lineLimit(1).minimumScaleFactor(0.6)
    }
  }
}

struct AddDepositSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var amount = ""
  @State private var depositDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        TextField("Amount", text: $amount).keyboardType(.decimalPad)
        DatePicker("Date", selection: $depositDate, displayedComponents: .date)
        TextField("Notes", text: $notes, axis: .vertical)
        if let error { Text(error).foregroundStyle(.red) }
      }
      .navigationTitle("Add deposit")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Add") { submit() }
            .disabled(Validate.positiveMoney(amount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
    .presentationDetents([.medium, .large])
  }

  private func submit() {
    do {
      try Store(context: context).addDeposit(
        to: investment, amount: Validate.positiveMoney(amount)!,
        depositDate: depositDate, notes: Validate.notes(notes, max: 500)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
```

- [ ] **Step 5: Build + unit tests**

Expected: `BUILD SUCCEEDED`, all green. Then confirm no noir styling remains under Investments:

```bash
grep -rn "noirForm\|Color.error\|Color.onSurface\|Color.brandPrimary\|Font.custom\|DetailHeader\|DangerButton\|NoirCard\|SectionGroup\|Radii\.\|Layout\." apps/ios/Phinio/Phinio/UI/Investments
```

Expected: no matches.

- [ ] **Step 6: Simulator check (both appearances)**

- Each detail: inline nav title, standard back button, ellipsis Menu with Edit / (Withdraw | Close early) / red Delete.
- Heroes: gradient cards with white text; DPS hero keeps its white progress bar.
- Lump-sum: LabeledContent rows; withdraw sheet opens at medium detent; withdrawal rows red with − amounts.
- DPS: three stat tiles legible in both appearances; schedule rows toggle paid on tap with green check circles; overdue rows show red subtitles; toggling syncs.
- Savings: Add deposit / Withdraw button rows; deposit history swipes to remove; deleting the pot pops back to the list.

- [ ] **Step 7: Commit**

```bash
git add -A apps/ios/Phinio/Phinio/UI
git commit -m "💄 style(ios): investment detail screens on native List + toolbar menus"
```

---
### Task 6: EMIs — list, form, detail

**Files:**
- Rewrite: `apps/ios/Phinio/Phinio/UI/Emis/EmiListView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Emis/EmiFormView.swift`
- Rewrite: `apps/ios/Phinio/Phinio/UI/Emis/EmiDetailView.swift` (includes `EmiEditSheet`)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components.swift` (delete `NoirCard`, `FilterPills`, `SegmentedTabs`, `NoirProgressBar`, `SectionHeader`)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components+Controls.swift` (delete `DangerButton`, `NoirFormStyle` + the `noirForm()`/`noirFormRow()` extension)

**Interfaces:**
- Consumes: `StatTile(label:value:alignment:)` (Task 5's new signature), `IconTile`, `MoneyText`, `TypePalette.crypto`, `Gradients.emiLoanHero/.emiCardHero`, `EmiCalculator`, `Store`, `EmiRoute` — unchanged.
- Deletes (last consumers convert here): `NoirCard`, `FilterPills`, `SegmentedTabs`, `NoirProgressBar`, `SectionHeader`, `DangerButton`, `NoirFormStyle`/`.noirForm()`/`.noirFormRow()`.

- [ ] **Step 1: Rewrite EmiListView.swift**

Replace the entire file with (remaining-balance math and filter logic byte-identical; same List pattern as Task 4):

```swift
import SwiftData
import SwiftUI

struct EmiListView: View {
  @Query(sort: \Emi.updatedAt, order: .reverse) private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var profiles: [Profile]

  @State private var statusIndex = 0  // 0 = Active, 1 = Completed
  @State private var typeIndex = 0  // 0 = All

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var showCompleted: Bool { statusIndex == 1 }

  private static let pillTypes = ["bank_loan", "credit_card"]

  private var byStatus: [Emi] {
    emis.filter { showCompleted ? $0.status == "completed" : $0.status == "active" }
  }

  private var filtered: [Emi] {
    guard typeIndex > 0 else { return byStatus }
    return byStatus.filter { $0.type == Self.pillTypes[typeIndex - 1] }
  }

  private var activeEmis: [Emi] { emis.filter { $0.status == "active" } }
  private var monthlyOutflow: Decimal { activeEmis.reduce(0) { $0 + $1.emiAmount } }
  private var totalRemaining: Decimal {
    activeEmis.reduce(0) { $0 + remaining(of: $1) }
  }

  /// Same basis as DashboardStats: the next unpaid payment's stored
  /// remainingBalance, not a sum of emiAmounts (those include interest and
  /// overstate the liability). `paymentNumber == 0` is the processing-fee
  /// sentinel and never counts as a scheduled payment.
  private func remaining(of emi: Emi) -> Decimal {
    let next = payments
      .filter { $0.emiId == emi.id && $0.paymentNumber > 0 && $0.status != "paid" }
      .min { $0.paymentNumber < $1.paymentNumber }
    return next?.remainingBalance ?? 0
  }

  var body: some View {
    List {
      Section {
        Picker("Status", selection: $statusIndex) {
          Text("Active").tag(0)
          Text("Completed").tag(1)
        }
        .pickerStyle(.segmented)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .onChange(of: statusIndex) { _, _ in typeIndex = 0 }
      }

      Section { summaryRow }

      if filtered.isEmpty {
        Section {
          ContentUnavailableView(
            showCompleted ? "Nothing completed yet" : "No EMIs yet",
            systemImage: "creditcard",
            description: Text(
              showCompleted
                ? "Finished loans and cards will appear here."
                : "Add a loan or credit card to track its schedule."))
            .listRowBackground(Color.clear)
        }
      } else {
        Section {
          ForEach(filtered) { emi in
            NavigationLink(value: EmiRoute(id: emi.id)) {
              EmiRow(
                emi: emi,
                schedule: payments.filter { $0.emiId == emi.id && $0.paymentNumber > 0 },
                remaining: remaining(of: emi),
                currency: currency)
            }
          }
        }
      }
    }
    .navigationTitle("EMIs")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Picker("Type", selection: $typeIndex) {
            Text("All").tag(0)
            Text("Bank Loan").tag(1)
            Text("Credit Card").tag(2)
          }
        } label: {
          Label(
            "Filter by type",
            systemImage: typeIndex == 0
              ? "line.3.horizontal.decrease.circle"
              : "line.3.horizontal.decrease.circle.fill")
        }
      }
    }
  }

  private var summaryRow: some View {
    HStack(spacing: 0) {
      summaryColumn("Active", "\(activeEmis.count)", .primary)
      Divider()
      summaryColumn("Monthly", monthlyOutflow.currencyCompact(currency), .primary)
      Divider()
      // Remaining balance is a liability — tinted red.
      summaryColumn("Remaining", totalRemaining.currencyCompact(currency), .red)
    }
    .padding(.vertical, 6)
  }

  private func summaryColumn(
    _ label: LocalizedStringKey, _ value: String, _ tint: Color
  ) -> some View {
    VStack(spacing: 5) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value)
        .font(.headline.monospacedDigit())
        .foregroundStyle(tint)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .combine)
  }
}

private struct EmiRow: View {
  let emi: Emi
  let schedule: [EmiPayment]
  let remaining: Decimal
  let currency: String

  private var isLoan: Bool { emi.type == "bank_loan" }
  private var paidCount: Int { schedule.count { $0.status == "paid" } }
  private var total: Int { max(schedule.count, emi.tenureMonths) }
  private var nextDue: Date? {
    schedule.filter { $0.status != "paid" }.map(\.dueDate).min()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 12) {
        IconTile(size: 42, radius: 12) {
          Image(systemName: isLoan ? "house" : "creditcard")
            .font(.system(size: 20))
            .foregroundStyle(isLoan ? Color.accentColor : TypePalette.crypto)
        }
        VStack(alignment: .leading, spacing: 2) {
          Text(emi.label).font(.headline).lineLimit(1)
          Text(isLoan ? "Bank Loan" : "Credit Card")
            .font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        VStack(alignment: .trailing, spacing: 2) {
          Text(emi.emiAmount.currency(currency))
            .font(.headline.monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.6)
          Text("per month").font(.caption).foregroundStyle(.secondary)
        }
      }

      ProgressView(value: total > 0 ? Double(paidCount) / Double(total) : 0) {
        HStack {
          Text("Remaining \(remaining.currency(currency))")
            .font(.caption).foregroundStyle(.secondary)
          Spacer()
          Text("\(paidCount) / \(total) months")
            .font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
        }
      }
      .padding(.top, 12)

      if let nextDue {
        (Text("Next due ") + Text(nextDue, format: .dateTime.day().month(.abbreviated).year()))
          .font(.caption)
          .foregroundStyle(.secondary)
          .padding(.top, 8)
      }
    }
    .padding(.vertical, 4)
  }
}
```

- [ ] **Step 2: Strip Modern Noir styling from EmiFormView.swift**

Apply the Task 4 form recipe (delete `.noirForm()` and every `.noirFormRow()`, `Color.error` → `.red`), plus these EMI-specific edits:

1. Delete the line `.listRowBackground(Color.clear.glassEffect(in: .rect(cornerRadius: 12)))` under the schedule-preview Section.
2. In the preview rows, replace `.font(.caption).foregroundStyle(Color.onSurfaceVariant)` with `.font(.footnote).foregroundStyle(.secondary)` (2 occurrences: due-date text and the "… and N more" line).
3. Replace `.font(.amountSecondary)` with `.font(.subheadline.monospacedDigit())`.

- [ ] **Step 3: Rewrite EmiDetailView.swift**

Replace the entire file with (schedule math, toggle/complete/delete logic byte-identical; amortization table becomes list rows with tap-to-toggle as today; per-row backgrounds via `.listRowBackground`):

```swift
import Charts
import SwiftData
import SwiftUI

struct EmiDetailView: View {
  let emiId: String
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var matches: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var profiles: [Profile]
  @State private var editing = false
  @State private var confirmComplete = false
  @State private var confirmDelete = false
  @State private var error: String?

  init(emiId: String) {
    self.emiId = emiId
    _matches = Query(filter: #Predicate<Emi> { $0.id == emiId })
    _payments = Query(
      filter: #Predicate<EmiPayment> { $0.emiId == emiId },
      sort: [SortDescriptor(\.paymentNumber)])
  }

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var fee: EmiPayment? { payments.first { $0.paymentNumber == 0 } }
  private var schedule: [EmiPayment] { payments.filter { $0.paymentNumber > 0 } }
  private var paidCount: Int { schedule.count { $0.status == "paid" } }

  /// Lifetime split, from the stored schedule rather than a re-derivation.
  private var totalInterest: Decimal { schedule.reduce(0) { $0 + $1.interestComponent } }
  private var interestPaid: Decimal {
    schedule.filter { $0.status == "paid" }.reduce(0) { $0 + $1.interestComponent }
  }
  private var remainingBalance: Decimal {
    schedule.first { $0.status != "paid" }?.remainingBalance ?? 0
  }

  var body: some View {
    if let emi {
      content(emi)
        .navigationTitle(emi.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .topBarTrailing) {
            Menu {
              Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
              if emi.status == "active" {
                Button { confirmComplete = true } label: {
                  Label("Complete early", systemImage: "checkmark.circle")
                }
              }
              Button(role: .destructive) { confirmDelete = true } label: {
                Label("Delete EMI", systemImage: "trash")
              }
            } label: {
              Label("More", systemImage: "ellipsis.circle")
            }
          }
        }
        .sheet(isPresented: $editing) { EmiEditSheet(emi: emi) }
        .confirmationDialog(
          "Mark all remaining payments as paid?", isPresented: $confirmComplete,
          titleVisibility: .visible
        ) {
          Button("Complete EMI") {
            do {
              try Store(context: context).completeEmi(emi)
              error = nil
              Task { await sync.syncNow() }
            } catch {
              self.error = error.localizedDescription
            }
          }
        }
        .confirmationDialog(
          "Delete this EMI and its schedule?", isPresented: $confirmDelete,
          titleVisibility: .visible
        ) {
          Button("Delete", role: .destructive) {
            try? Store(context: context).deleteEmi(emi)
            Task { await sync.syncNow() }
            dismiss()
          }
        }
    } else {
      ContentUnavailableView(
        "Not found", systemImage: "questionmark.circle",
        description: Text("This EMI is no longer on this device."))
    }
  }

  private var emi: Emi? { matches.first }

  private func content(_ emi: Emi) -> some View {
    let isLoan = emi.type == "bank_loan"
    return List {
      Section {
        hero(emi, isLoan: isLoan)
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        HStack(spacing: 10) {
          StatTile(label: "Paid months", value: "\(paidCount) / \(schedule.count)")
          StatTile(label: "Remaining", value: "\(schedule.count - paidCount)")
          StatTile(label: "Interest paid", value: interestPaid.currencyCompact(currency))
        }
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section("Principal vs interest") {
        splitRow(emi)
      }

      Section("Amortization schedule") {
        if let error {
          Text(error).font(.footnote).foregroundStyle(.red)
        }
        columnHeader
        if let fee { feeRow(fee) }
        ForEach(schedule) { p in
          paymentRow(p)
            .listRowBackground(rowBackground(
              paid: p.status == "paid",
              overdue: p.status != "paid" && utcDaysUntil(p.dueDate, from: Date()) < 0))
        }
      }
    }
  }

  private func hero(_ emi: Emi, isLoan: Bool) -> some View {
    HeroCard(
      gradient: isLoan ? Gradients.emiLoanHero : Gradients.emiCardHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text(isLoan ? "Bank Loan · Remaining Balance" : "Credit Card · Remaining Balance")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.7))
        Text(remainingBalance.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        Text(emi.emiAmount.currency(currency) + "/mo")
          .font(.footnote.weight(.semibold).monospacedDigit())
          .foregroundStyle(.white.opacity(0.7))
          .padding(.top, 10)
      }
    }
  }

  private func splitRow(_ emi: Emi) -> some View {
    HStack(spacing: 20) {
      Chart {
        SectorMark(
          angle: .value("Principal", Double(truncating: NSDecimalNumber(decimal: emi.principal))),
          innerRadius: .ratio(0.655), angularInset: 0
        )
        .foregroundStyle(Color.accentColor)
        SectorMark(
          angle: .value("Interest", Double(truncating: NSDecimalNumber(decimal: totalInterest))),
          innerRadius: .ratio(0.655), angularInset: 0
        )
        .foregroundStyle(TypePalette.crypto)
      }
      .chartLegend(.hidden)
      .frame(width: 110, height: 110)
      .overlay {
        VStack(spacing: 2) {
          Text("Total")
            .font(.caption2)
            .textCase(.uppercase)
            .foregroundStyle(.secondary)
          Text((emi.principal + totalInterest).currencyCompact(currency))
            .font(.caption.weight(.bold).monospacedDigit())
            .lineLimit(1).minimumScaleFactor(0.5)
        }
        .padding(.horizontal, 10)
      }
      .accessibilityHidden(true)  // the legend below states both figures

      VStack(alignment: .leading, spacing: 14) {
        splitLegend("Principal", emi.principal, Color.accentColor)
        splitLegend("Interest", totalInterest, TypePalette.crypto)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.vertical, 8)
  }

  private func splitLegend(_ label: LocalizedStringKey, _ value: Decimal, _ tint: Color) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 8) {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(tint).frame(width: 10, height: 10)
        Text(label).font(.footnote).foregroundStyle(.secondary)
      }
      Text(value.currency(currency))
        .font(.headline.monospacedDigit())
        .lineLimit(1).minimumScaleFactor(0.6)
        .padding(.leading, 18)
    }
    .accessibilityElement(children: .combine)
  }

  // MARK: Amortization

  private var columnHeader: some View {
    HStack(spacing: 4) {
      Text("#").frame(width: 22, alignment: .leading)
      Text("Due").frame(width: 40, alignment: .leading)
      Text("EMI").frame(maxWidth: .infinity, alignment: .trailing)
      Text("Prin.").frame(maxWidth: .infinity, alignment: .trailing)
      Text("Int.").frame(maxWidth: .infinity, alignment: .trailing)
      Text("Bal.").frame(maxWidth: .infinity, alignment: .trailing)
      Color.clear.frame(width: 26)
    }
    .font(.caption2.weight(.semibold))
    .textCase(.uppercase)
    .foregroundStyle(.secondary)
  }

  /// Processing fee is `paymentNumber == 0` — shown, but never part of the
  /// paid/total counts or the progress figures.
  private func feeRow(_ fee: EmiPayment) -> some View {
    HStack(spacing: 4) {
      Text("—").frame(width: 22, alignment: .leading)
      Text("Fee").frame(width: 40, alignment: .leading)
      Text(fee.emiAmount.currencyCompact(currency))
        .frame(maxWidth: .infinity, alignment: .trailing)
      Text("—").frame(maxWidth: .infinity, alignment: .trailing)
      Text("—").frame(maxWidth: .infinity, alignment: .trailing)
      Text("—").frame(maxWidth: .infinity, alignment: .trailing)
      Color.clear.frame(width: 26)
    }
    .font(.caption2.monospacedDigit())
    .foregroundStyle(.secondary)
  }

  private func paymentRow(_ p: EmiPayment) -> some View {
    let paid = p.status == "paid"
    let overdue = !paid && utcDaysUntil(p.dueDate, from: Date()) < 0
    return Button {
      toggle(p)
    } label: {
      HStack(spacing: 4) {
        Text("\(p.paymentNumber)").frame(width: 22, alignment: .leading)
        Text(p.dueDate, format: .dateTime.month(.abbreviated).year(.twoDigits))
          .frame(width: 40, alignment: .leading)
        Text(p.emiAmount.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Text(p.principalComponent.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Text(p.interestComponent.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Text(p.remainingBalance.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Image(systemName: paid ? "checkmark.circle.fill" : "circle")
          .font(.subheadline)
          .foregroundStyle(paid ? Color.green : Color(.separator))
          .frame(width: 26, alignment: .trailing)
          .accessibilityHidden(true)
      }
      .font(.caption2.monospacedDigit())
      .foregroundStyle(paid ? Color.secondary : Color.primary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    // No explicit .frame(minHeight: 44) here: the old hand-drawn table needed
    // one because it stacked its own rows with only 9pt of padding, but a List
    // row supplies system insets — measured at 56pt, above the 44pt minimum.
    .accessibilityLabel("Payment \(p.paymentNumber), \(p.emiAmount.currency(currency))")
    .accessibilityValue(paid ? "Paid" : overdue ? "Overdue" : "Unpaid")
    .accessibilityHint("Double tap to mark \(paid ? "unpaid" : "paid")")
  }

  @ViewBuilder
  private func rowBackground(paid: Bool, overdue: Bool) -> some View {
    ZStack {
      Color(.secondarySystemGroupedBackground)
      if overdue {
        Color.red.opacity(0.08)
      } else if !paid {
        Color.accentColor.opacity(0.05)
      }
    }
  }

  /// Optimistic — Store writes locally and enqueues the mutation; a failed
  /// write surfaces inline rather than silently dropping.
  private func toggle(_ p: EmiPayment) {
    do {
      try Store(context: context).markPaymentPaid(p, paid: p.status != "paid")
      error = nil
      Task { await sync.syncNow() }
    } catch {
      self.error = error.localizedDescription
    }
  }
}

struct EmiEditSheet: View {
  let emi: Emi
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var label = ""
  @State private var notes = ""

  var body: some View {
    NavigationStack {
      Form {
        TextField("Label", text: $label)
        TextField("Notes", text: $notes, axis: .vertical)
      }
      .navigationTitle("Edit EMI")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            try? Store(context: context).updateEmi(
              emi, label: Validate.name(label)!, notes: Validate.notes(notes)!)
            Task { await sync.syncNow() }
            dismiss()
          }
          .disabled(Validate.name(label) == nil || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        label = emi.label
        notes = emi.notes ?? ""
      }
    }
    .presentationDetents([.medium, .large])
  }
}
```

- [ ] **Step 4: Delete components whose last consumer just converted**

Verify each is unreferenced, then delete:

```bash
grep -rn "NoirCard\|FilterPills\|SegmentedTabs\|NoirProgressBar\|SectionHeader(\|DangerButton\|noirForm\|NoirFormStyle" apps/ios/Phinio/Phinio
```

Expected: matches only inside their own definitions in `Components.swift` / `Components+Controls.swift`. Then delete:
- From `Components.swift`: the `NoirCard`, `FilterPills`, `SegmentedTabs`, `NoirProgressBar`, `SectionHeader` structs.
- From `Components+Controls.swift`: the `DangerButton` struct, the `NoirFormStyle` ViewModifier, and the `extension View { func noirForm() ... func noirFormRow() ... }` block.

Re-run the grep. Expected: no matches.

- [ ] **Step 5: Build + unit tests**

Expected: `BUILD SUCCEEDED`, all green (including `StoreEmiTests`, `EmiCalculatorTests` — untouched logic).

- [ ] **Step 6: Simulator check (both appearances)**

- EMI list: segmented status, toolbar type filter, summary row (Remaining in red), rows with icon tiles and native progress bars; navigation to detail.
- EMI form: native Form; schedule preview shows monthly EMI + first 3 rows.
- EMI detail: gradient hero (blue for loans, purple for cards), three stat tiles, principal/interest donut with legend, amortization rows — unpaid rows faintly accent-tinted, overdue faintly red, tap toggles paid and the hero/tiles update. Complete early → confirmation → all paid. Delete pops back.

- [ ] **Step 7: Commit**

```bash
git add -A apps/ios/Phinio/Phinio/UI
git commit -m "💄 style(ios): EMI screens on native List/Form, amortization as list rows"
```

---

### Task 7: Activity, notifications, offline banner

**Files:**
- Rewrite: `apps/ios/Phinio/Phinio/UI/Activity/ActivityView.swift`
- Rewrite: `apps/ios/Phinio/Phinio/UI/Activity/NotificationsView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components+Controls.swift` (replace `OfflineBanner`; delete `NoirEmptyState`, `DetailHeader` + its `EmptyView` extension)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components.swift` (delete `SectionGroup`)

**Interfaces:**
- Consumes: `APIClient.fetchActivity(cursor:)`, `ActivityItemDTO`, `ActivityChangeDTO`, `WireDate`, `Store.markNotificationRead/markAllNotificationsRead`, `DeepLink.parse`, `Money.decimal` — unchanged.
- Produces: `OfflineBanner()` — same name, now a system-material capsule (already consumed by DashboardView's `safeAreaInset` since Task 3).
- Note: the spec asks for "swipe actions for read/unread"; the frozen `Store` has no mark-unread API, so the swipe action is **Mark read** only (tap already marks read + follows the link). Documented deviation, not an omission.

- [ ] **Step 1: Rewrite ActivityView.swift**

Replace the entire file with (paging, error handling, tint/symbol maps unchanged; `DetailHeader` replaced by the native nav bar — this screen is pushed from Profile):

```swift
import SwiftUI

/// Online-only: the activity log is server-derived and not in the snapshot.
struct ActivityView: View {
  @State private var items: [ActivityItemDTO] = []
  @State private var nextCursor: String?
  @State private var loading = false
  @State private var offline = false
  private let client = APIClient()

  var body: some View {
    List {
      if offline && items.isEmpty {
        ContentUnavailableView(
          "Offline", systemImage: "wifi.slash",
          description: Text("Activity needs a connection."))
          .listRowBackground(Color.clear)
      } else if loading && items.isEmpty {
        skeleton
      } else if items.isEmpty {
        ContentUnavailableView(
          "No activity", systemImage: "clock.arrow.circlepath",
          description: Text("Changes you make will show up here."))
          .listRowBackground(Color.clear)
      } else {
        Section {
          ForEach(items) { row($0) }
          if nextCursor != nil {
            loadMoreRow
          }
        }
      }
    }
    .navigationTitle("Activity")
    .navigationBarTitleDisplayMode(.inline)
    .task { await reload() }
    .refreshable { await reload() }
  }

  /// Placeholder shimmer on first load rather than a bare full-screen spinner.
  private var skeleton: some View {
    Section {
      ForEach(0..<5, id: \.self) { _ in
        HStack(spacing: 12) {
          IconTile(size: 38, radius: 11) { Color.clear }
          VStack(alignment: .leading, spacing: 6) {
            Text("Placeholder summary text")
              .font(.body)
            Text("Entity · moments ago")
              .font(.caption).foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
    .redacted(reason: .placeholder)
    .accessibilityHidden(true)
  }

  private var loadMoreRow: some View {
    Button {
      Task { await loadMore() }
    } label: {
      Group {
        if loading {
          ProgressView().controlSize(.small)
        } else {
          Text("Load more")
        }
      }
      .frame(maxWidth: .infinity)
    }
    .disabled(loading)
  }

  private func row(_ item: ActivityItemDTO) -> some View {
    HStack(alignment: .top, spacing: 12) {
      IconTile(size: 38, radius: 11, background: tint(item.action).opacity(0.12)) {
        Image(systemName: symbol(item.action))
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(tint(item.action))
      }
      VStack(alignment: .leading, spacing: 3) {
        Text(item.summary)
          .font(.body)
          .fixedSize(horizontal: false, vertical: true)
        HStack(spacing: 6) {
          Text(item.entityLabel).font(.caption).foregroundStyle(.secondary)
          if let date = WireDate.timestamp(item.createdAt) {
            Text("·").font(.caption).foregroundStyle(.secondary)
            Text(date, format: .relative(presentation: .named))
              .font(.caption).foregroundStyle(.secondary)
          }
        }
        // Updates carry a field-level diff (old → new).
        if let changes = item.changes, !changes.isEmpty {
          VStack(alignment: .leading, spacing: 2) {
            ForEach(changes.indices, id: \.self) { i in
              diffLine(changes[i])
            }
          }
          .padding(.top, 4)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .combine)
    .onAppear {
      if item.id == items.last?.id, nextCursor != nil {
        Task { await loadMore() }
      }
    }
  }

  private func diffLine(_ change: ActivityChangeDTO) -> some View {
    HStack(spacing: 4) {
      Text(change.field).foregroundStyle(.secondary)
      Text(format(change.from, change.currency)).foregroundStyle(.tertiary)
      Image(systemName: "arrow.right").font(.system(size: 8))
        .foregroundStyle(.tertiary)
      Text(format(change.to, change.currency)).foregroundStyle(.secondary)
    }
    .font(.caption)
  }

  private func format(_ value: String?, _ currency: String?) -> String {
    guard let value, !value.isEmpty else { return "—" }
    guard let currency, let amount = Money.decimal(value) else { return value }
    return amount.currency(currency)
  }

  private func tint(_ action: String) -> Color {
    switch action {
    case "create": .green
    case "delete": .red
    default: .accentColor
    }
  }

  private func symbol(_ action: String) -> String {
    switch action {
    case "create": "plus"
    case "delete": "trash"
    default: "pencil"
    }
  }

  private func reload() async {
    loading = true
    defer { loading = false }
    do {
      let page = try await client.fetchActivity(cursor: nil)
      items = page.items
      nextCursor = page.nextCursor
      offline = false
    } catch {
      offline = true
    }
  }

  private func loadMore() async {
    guard let cursor = nextCursor, !loading else { return }
    loading = true
    defer { loading = false }
    do {
      let page = try await client.fetchActivity(cursor: cursor)
      items += page.items
      nextCursor = page.nextCursor
    } catch {
      nextCursor = nil  // stop paginating; pull-to-refresh recovers
    }
  }
}
```

Note: `@Environment(\.dismiss)` is dropped — the native back button handles it.

- [ ] **Step 2: Rewrite NotificationsView.swift**

Replace the entire file with (sort and tap behavior unchanged; presented inside `NavigationStack` as a sheet, so it gets a nav bar with Mark-all-read and Done):

```swift
import SwiftData
import SwiftUI

/// Presented as a sheet from the Home bell.
struct NotificationsView: View {
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @Query private var all: [AppNotification]

  /// Unread first, then newest — the sort SwiftData can't express in one
  /// descriptor, so it happens here.
  private var notifications: [AppNotification] {
    all.sorted {
      ($0.readAt == nil ? 0 : 1, $1.createdAt) < ($1.readAt == nil ? 0 : 1, $0.createdAt)
    }
  }

  private var hasUnread: Bool { all.contains { $0.readAt == nil } }

  var body: some View {
    List {
      if notifications.isEmpty {
        ContentUnavailableView(
          "No notifications", systemImage: "bell",
          description: Text("Payment reminders will show up here."))
          .listRowBackground(Color.clear)
      } else {
        ForEach(notifications) { row($0) }
      }
    }
    .navigationTitle("Notifications")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        if hasUnread {
          Button("Mark all read") {
            try? Store(context: context).markAllNotificationsRead()
            Task { await sync.syncNow() }
          }
        }
      }
      ToolbarItem(placement: .confirmationAction) {
        Button("Done") { dismiss() }
      }
    }
  }

  private func row(_ n: AppNotification) -> some View {
    let unread = n.readAt == nil
    return Button {
      if unread {
        try? Store(context: context).markNotificationRead(n)
        Task { await sync.syncNow() }
      }
      if let link = n.link, let parsed = DeepLink.parse(link) {
        deepLink.pending = parsed
        dismiss()
      }
    } label: {
      HStack(alignment: .top, spacing: 12) {
        Circle()
          .fill(unread ? Color.accentColor : .clear)
          .frame(width: 8, height: 8)
          .padding(.top, 6)
        VStack(alignment: .leading, spacing: 3) {
          Text(n.title)
            .font(.body.weight(unread ? .semibold : .regular))
            .foregroundStyle(unread ? Color.primary : Color.secondary)
          Text(n.body)
            .font(.footnote).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
          Text(n.createdAt, format: .relative(presentation: .named))
            .font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    // Store has no mark-unread API (frozen layer) — swipe offers Mark read only.
    .swipeActions {
      if unread {
        Button("Mark read") {
          try? Store(context: context).markNotificationRead(n)
          Task { await sync.syncNow() }
        }
        .tint(.accentColor)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(unread ? "Unread" : "Read")
  }
}
```

- [ ] **Step 3: Re-render OfflineBanner on a system-material capsule**

In `Components+Controls.swift`, replace the `OfflineBanner` struct with:

```swift
/// Connectivity capsule under the nav bar, on system material so it reads in
/// both appearances.
struct OfflineBanner: View {
  var body: some View {
    Label("Offline — changes sync when you reconnect.", systemImage: "wifi.slash")
      .font(.footnote)
      .foregroundStyle(.secondary)
      .padding(.horizontal, 14)
      .padding(.vertical, 8)
      .background(.regularMaterial, in: .capsule)
      .padding(.top, 4)
      .accessibilityElement(children: .combine)
  }
}
```

- [ ] **Step 4: Delete components whose last consumer just converted**

```bash
grep -rn "DetailHeader\|NoirEmptyState\|SectionGroup" apps/ios/Phinio/Phinio
```

Expected: matches only inside the definitions. Delete `DetailHeader` and its `extension DetailHeader where Trailing == EmptyView` from `Components+Controls.swift`, `NoirEmptyState` from `Components+Controls.swift`, and `SectionGroup` from `Components.swift`. Re-run the grep — expected: no matches.

- [ ] **Step 5: Build + unit tests**

Expected: `BUILD SUCCEEDED`, all green (including `ActivityDTOTests`).

- [ ] **Step 6: Simulator check (both appearances)**

- Profile → Activity history: native pushed screen with back button; skeleton shimmer on first load; rows with tinted icons and diff lines; infinite scroll + Load more; offline state when the server is unreachable.
- Bell → Notifications sheet: nav bar with Mark all read + Done; unread rows bold with accent dot; swipe an unread row → Mark read; tapping a payment-reminder notification deep-links to the EMI/DPS detail and closes the sheet.
- Airplane-mode the simulator (or kill the dev server): Home shows the material offline capsule under the nav bar, legible in both appearances.

- [ ] **Step 7: Commit**

```bash
git add -A apps/ios/Phinio/Phinio/UI
git commit -m "💄 style(ios): activity + notifications on native List, material offline capsule"
```

---
### Task 8: Onboarding + auth

**Files:**
- Modify: `apps/ios/Phinio/Phinio/UI/Onboarding/GetStartedView.swift`
- Rewrite: `apps/ios/Phinio/Phinio/UI/Onboarding/AuthStepView.swift`
- Modify: `apps/ios/Phinio/Phinio/UI/Onboarding/OnboardingView.swift` (`PrimingStep`, `InitialSyncStep`)
- Modify: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components+Controls.swift` (delete `CarvedTextField`, `PrimaryButton`, `TextButton`)

**Interfaces:**
- Consumes: `AuthManager.signIn/signUp`, `APIError.rejected`, `Validate.name`, `PushManager.requestAndRegister`, `SyncEngine` — unchanged.
- Signatures unchanged: `GetStartedView(onSignUp:onLogin:)`, `AuthStepView(startMode:done:)`, `OnboardingView(startAt:)`.

- [ ] **Step 1: Convert GetStartedView to system fonts/colors (animations kept)**

Apply these exact replacements in `GetStartedView.swift`:

| Old | New |
| --- | --- |
| `Color.surface.ignoresSafeArea()` | `Color(.systemBackground).ignoresSafeArea()` |
| `.fill(Color.primaryContainer.opacity(0.05))` (orb) | `.fill(Color.accentColor.opacity(0.05))` |
| `.fill(Color.primaryContainer.opacity(0.20))` (glow) | `.fill(Color.accentColor.opacity(0.20))` |
| `.strokeBorder(Color.onHero.opacity(0.05), lineWidth: 1)` | `.strokeBorder(Color.primary.opacity(0.05), lineWidth: 1)` |
| `.fill(Color.brandSecondary)` (badge dot) | `.fill(Color.green)` |
| `.overlay(Circle().strokeBorder(Color.surface, lineWidth: 3))` | `.overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 3))` |
| `.font(.custom("Manrope-ExtraBold", size: 48))` + `.tracking(-0.02 * 48)` + `.foregroundStyle(Color.onSurface)` | `.font(.system(size: 48, weight: .heavy))` + `.foregroundStyle(.primary)` (delete the tracking line) |
| `.font(.custom("Inter-SemiBold", size: 14))` + `.tracking(0.2 * 14)` + `.foregroundStyle(Color.onSurfaceVariant)` | `.font(.footnote.weight(.semibold))` + `.tracking(2.8)` + `.foregroundStyle(.secondary)` |
| `.font(.meta)` + `.foregroundStyle(Color.onSurfaceMuted)` (footer) | `.font(.caption)` + `.foregroundStyle(.secondary)` |

And replace the `actions` property body's button stack with:

```swift
    VStack(spacing: 4) {
      Button {
        onSignUp()
      } label: {
        Text("Get Started").frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.large)

      Button("I already have an account", action: onLogin)
        .buttonStyle(.borderless)
        .controlSize(.large)
    }
    .frame(maxWidth: 320)
    .opacity(appeared ? 1 : 0)
    .offset(y: appeared ? 0 : 12)
    .animation(.spring(duration: 0.5, bounce: 0.2).delay(0.9), value: appeared)
```

- [ ] **Step 2: Rewrite AuthStepView.swift on a native Form**

Replace the entire file with (`trySignIn`/`submitSignUp` byte-identical; the carved fields become Form rows, currency tiles become a segmented Picker, submit becomes a glass-prominent button pinned above the keyboard):

```swift
import SwiftUI

/// Sign-in / sign-up with the "check your email" verification loop:
/// after sign-up we retry sign-in on demand until verification sticks.
struct AuthStepView: View {
  let done: () -> Void
  @EnvironmentObject private var auth: AuthManager

  enum Mode { case signIn, signUp, checkEmail }
  @State private var mode: Mode
  @State private var name = ""
  @State private var email = ""
  @State private var password = ""
  @State private var showPassword = false
  @State private var currency = "BDT"
  @State private var error: String?
  @State private var busy = false

  init(startMode: Mode = .signIn, done: @escaping () -> Void) {
    _mode = State(initialValue: startMode)
    self.done = done
  }

  var body: some View {
    NavigationStack {
      Form {
        switch mode {
        case .checkEmail: checkEmailSections
        case .signIn, .signUp: formSections
        }
      }
      .scrollDismissesKeyboard(.interactively)
      .navigationTitle(title)
      .safeAreaInset(edge: .bottom) { actions }
    }
  }

  private var title: LocalizedStringKey {
    switch mode {
    case .signIn: "Welcome back"
    case .signUp: "Create account"
    case .checkEmail: "Check your email"
    }
  }

  @ViewBuilder
  private var formSections: some View {
    Section {
      if mode == .signUp {
        TextField("Full name", text: $name)
          .textContentType(.name)
      }
      TextField("Email", text: $email)
        .textContentType(.emailAddress)
        .keyboardType(.emailAddress)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
      HStack(spacing: 8) {
        Group {
          if showPassword {
            TextField(passwordPrompt, text: $password)
          } else {
            SecureField(passwordPrompt, text: $password)
          }
        }
        .textContentType(mode == .signUp ? .newPassword : .password)
        Button { showPassword.toggle() } label: {
          Image(systemName: showPassword ? "eye.slash" : "eye")
            .foregroundStyle(.secondary)
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(showPassword ? "Hide password" : "Show password")
      }
    } footer: {
      Text(mode == .signUp
        ? "Start tracking investments and EMIs."
        : "Sign in to your vault.")
    }

    if mode == .signUp {
      Section("Preferred currency") {
        Picker("Preferred currency", selection: $currency) {
          Text("৳ BDT").tag("BDT")
          Text("$ USD").tag("USD")
        }
        .pickerStyle(.segmented)
        .labelsHidden()
      }
    }

    if let error { errorSection(error) }
  }

  @ViewBuilder
  private var checkEmailSections: some View {
    Section {
      Text("We sent a verification link to \(email). Tap it, then come back here.")
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    if let error { errorSection(error) }
  }

  /// Form-level slot — auth failures ("wrong password", "can't reach the
  /// server") belong to the form, not a single field.
  private func errorSection(_ message: String) -> some View {
    Section {
      Text(message).foregroundStyle(.red)
    }
  }

  private var passwordPrompt: LocalizedStringKey {
    mode == .signUp ? "At least 8 characters" : "Password"
  }

  private var actions: some View {
    VStack(spacing: 4) {
      Button {
        switch mode {
        case .checkEmail, .signIn: Task { await trySignIn() }
        case .signUp: Task { await submitSignUp() }
        }
      } label: {
        Group {
          if busy {
            ProgressView().controlSize(.small)
          } else {
            Text(primaryCta)
          }
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.large)
      .disabled(busy || !canSubmit)

      Button(secondaryCta) {
        error = nil
        switch mode {
        case .signUp: mode = .signIn
        case .signIn: mode = .signUp
        case .checkEmail: mode = .signUp
        }
      }
      .buttonStyle(.borderless)
      .controlSize(.large)
    }
    .padding(.horizontal, 20)
    .padding(.bottom, 8)
  }

  private var primaryCta: LocalizedStringKey {
    switch mode {
    case .signIn: "Login"
    case .signUp: "Create Account"
    case .checkEmail: "I've verified — continue"
    }
  }

  private var secondaryCta: LocalizedStringKey {
    switch mode {
    case .signIn: "Don't have an account? Sign Up"
    case .signUp: "Already have an account? Login"
    case .checkEmail: "Use a different email"
    }
  }

  private var canSubmit: Bool {
    if mode == .checkEmail { return true }
    guard !email.isEmpty, !password.isEmpty else { return false }
    if mode == .signUp {
      return Validate.name(name, min: 2) != nil && password.count >= 8
    }
    return true
  }

  private func trySignIn() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signIn(email: email, password: password)
      done()
    } catch let APIError.rejected(_, message) {
      error = mode == .checkEmail
        ? "Not verified yet — try again in a moment."
        : message
    } catch {
      self.error = "Could not reach the server."
    }
  }

  private func submitSignUp() async {
    busy = true
    defer { busy = false }
    do {
      try await auth.signUp(
        name: name.trimmingCharacters(in: .whitespaces),
        email: email, password: password, preferredCurrency: currency)
      error = nil
      mode = .checkEmail
    } catch let APIError.rejected(_, message) {
      error = message
    } catch {
      self.error = "Could not reach the server."
    }
  }
}
```

- [ ] **Step 3: Convert PrimingStep and InitialSyncStep in OnboardingView.swift**

Replace the `PrimingStep` struct with:

```swift
private struct PrimingStep: View {
  let done: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      Spacer()
      IconTile(size: 88, radius: 26, background: Color.accentColor.opacity(0.12)) {
        Image(systemName: "bell.badge")
          .font(.system(size: 40))
          .foregroundStyle(.tint)
      }
      Text("Payment reminders")
        .font(.title3.weight(.semibold))
        .padding(.top, 8)
      Text("Get notified before EMI payments and DPS installments are due, so nothing slips.")
        .font(.subheadline)
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
      Spacer()
      Button {
        Task {
          await PushManager.requestAndRegister()
          done()
        }
      } label: {
        Text("Enable reminders").frame(maxWidth: .infinity)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.large)
      Button("Maybe later", action: done)
        .buttonStyle(.borderless)
        .controlSize(.large)
    }
    .padding(.horizontal, 36)
    .padding(.bottom, 40)
    .background(Color(.systemBackground))
  }
}
```

Replace the `InitialSyncStep` struct with:

```swift
private struct InitialSyncStep: View {
  @EnvironmentObject private var sync: SyncEngine
  let done: () -> Void

  var body: some View {
    VStack(spacing: 14) {
      ProgressView().controlSize(.large)
      Text("Getting your data…")
        .font(.subheadline).foregroundStyle(.secondary)
      if sync.state == .offline {
        Text("Couldn't reach the server — you can start offline.")
          .font(.footnote).foregroundStyle(.secondary)
        Button("Continue", action: done)
          .buttonStyle(.borderless)
          .controlSize(.large)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(.horizontal, 36)
    .background(Color(.systemBackground))
    .task {
      await sync.syncNow()
      done()  // idle or offline — either way the app is usable
    }
  }
}
```

- [ ] **Step 4: Delete the last hand-rolled inputs**

```bash
grep -rn "CarvedTextField\|PrimaryButton\|TextButton" apps/ios/Phinio/Phinio
```

Expected: matches only inside the definitions in `Components+Controls.swift`. Delete the `CarvedTextField`, `PrimaryButton`, and `TextButton` structs there. Re-run the grep — expected: no matches.

- [ ] **Step 5: Build + unit tests**

Expected: `BUILD SUCCEEDED`, all green.

- [ ] **Step 6: Simulator check (both appearances)**

Erase the app (`xcrun simctl uninstall "$UDID" com.phinio.app`), reinstall, and walk the first-launch flow:
- Welcome: logo/wordmark animation intact on system background (white in light, black in dark); Get Started is a glass-prominent button.
- Sign up: native Form, segmented currency picker, submit disabled until name ≥ 2 chars + email + 8-char password; error section renders in red; check-email loop reachable.
- Login: Form with password reveal toggle; wrong-password error surfaces.
- Priming: accent bell tile, glass-prominent Enable reminders, Maybe later; then initial sync spinner → dashboard.

- [ ] **Step 7: Commit**

```bash
git add -A apps/ios/Phinio/Phinio/UI
git commit -m "💄 style(ios): onboarding + auth on native forms and glass buttons"
```

---

### Task 9: Cleanup — fonts, typography, token collapse, sweeps

**Files:**
- Delete: `apps/ios/Phinio/Phinio/Resources/Fonts/` (9 `.ttf` + 2 OFL licenses; removes the whole directory)
- Delete: `apps/ios/Phinio/Phinio/UI/DesignSystem/Typography.swift`
- Delete: `apps/ios/Phinio/PhinioTests/FontLoadingTests.swift`
- Modify: `apps/ios/Phinio/Phinio/Info.plist` (remove `UIAppFonts`)
- Rewrite: `apps/ios/Phinio/Phinio/UI/DesignSystem/Tokens.swift` (collapse to TypePalette + Gradients)
- Rewrite: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components.swift` (only the surviving leaves)
- Delete: `apps/ios/Phinio/Phinio/UI/DesignSystem/Components+Controls.swift` (survivors merge into Components.swift)

**Interfaces:**
- Survivors, signatures stable: `HeroCard(gradient:orbTint:radius:orbSize:orbTopOffset:bottomPadding:content:)`, `StatTile(label:value:alignment:)`, `MoneyPill(percent:size:)`, `TypeBadge(type:)`, `AvatarView(initials:size:)`, `IconTile(size:radius:background:icon:)`, `OfflineBanner()`, plus `TypePalette` and `Gradients` (minus `summaryCard`).

- [ ] **Step 1: Delete fonts, typography, and the font test**

```bash
git rm -r apps/ios/Phinio/Phinio/Resources/Fonts
git rm apps/ios/Phinio/Phinio/UI/DesignSystem/Typography.swift
git rm apps/ios/Phinio/PhinioTests/FontLoadingTests.swift
```

Replace the entire contents of `apps/ios/Phinio/Phinio/Info.plist` with (the file stays — removing `INFOPLIST_FILE` would mean pbxproj surgery for zero benefit):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
```

Confirm nothing references the fonts:

```bash
grep -rn "Font.custom\|Manrope\|Inter-\|UIAppFonts\|Typography" apps/ios/Phinio/Phinio apps/ios/Phinio/PhinioTests
```

Expected: no matches. Any hit is a screen conversion that was missed — fix it with the translation tables before continuing.

- [ ] **Step 2: Collapse Tokens.swift**

Replace the entire file with:

```swift
import SwiftUI
import UIKit

// Phinio brand remnants on the native re-skin: the investment-type palette and
// the gradient hero cards. Everything else uses system semantic colors.

private extension UIColor {
  convenience init(hex: UInt32) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1)
  }
}

private extension Color {
  init(hex: UInt32) {
    self.init(uiColor: UIColor(hex: hex))
  }

  /// Adaptive brand color: `light` in light appearance, `dark` in dark.
  init(light: UInt32, dark: UInt32) {
    self.init(uiColor: UIColor { trait in
      trait.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
    })
  }
}

/// Drives investment-type badge bg/fg, donut slice, and legend swatch — one
/// source of truth so the three never disagree. Dark values are the Modern Noir
/// hues; light values are darkened same-hue variants for contrast on light
/// backgrounds. Background is foreground at 16% alpha.
enum TypePalette {
  static let stock = Color(light: 0x3D5AC8, dark: 0xB4C5FF)
  static let mutualFund = Color(light: 0x0E8F5F, dark: 0x4EDEA3)
  static let gold = Color(light: 0xA1720E, dark: 0xFFCF70)
  static let crypto = Color(light: 0x7C3AED, dark: 0xC79BFF)
  static let fd = Color(light: 0x0A7EA4, dark: 0x6FD0FF)
  /// Rose, not the comp's mint — mint collided with Mutual Fund on the
  /// allocation donut (see the Modern Noir spec, decision #6).
  static let dps = Color(light: 0xC2447E, dark: 0xFF9ECD)
  /// Light value is a deep navy, not a mid indigo like the dark one. Darkening
  /// both blues for light mode collapsed savings onto stock (CIELAB DeltaE 5.2 —
  /// perceptually identical), drawing two identical allocation slices. Navy
  /// restores the lightness separation (DeltaE 37.9 from stock, >=24 from all).
  static let savings = Color(light: 0x1B3B6D, dark: 0x7FA0FF)
  static let other = Color(light: 0x6B7280, dark: 0xC3C6D7)

  /// Maps `Investment.type` raw values (see Support/Formatting.swift) onto the
  /// 8 hues above. sanchayapatra (fixed-income) -> fd, real_estate/agro_farm
  /// (physical store-of-value) -> gold, business (equity-like) -> stock.
  static func foreground(for rawType: String) -> Color {
    switch rawType {
    case "stock", "business": stock
    case "mutual_fund": mutualFund
    case "gold", "real_estate", "agro_farm": gold
    case "crypto": crypto
    case "fd", "sanchayapatra": fd
    case "dps": dps
    case "savings": savings
    default: other
    }
  }

  static func background(for rawType: String) -> Color {
    foreground(for: rawType).opacity(0.16)
  }
}

/// Fixed dark gradients for the hero cards — the one deliberate non-standard
/// element; white content on top in both appearances.
enum Gradients {
  /// CSS `linear-gradient(Ndeg, …)` measures clockwise from "to top"; SwiftUI
  /// takes two UnitPoints. Converting the angle explicitly keeps every hero's
  /// falloff direction right regardless of its aspect ratio.
  private static func angled(_ degrees: Double, _ stops: [Gradient.Stop]) -> LinearGradient {
    let r = degrees * .pi / 180
    let dx = sin(r), dy = -cos(r)  // y grows downward in UnitPoint space
    return LinearGradient(
      stops: stops,
      startPoint: UnitPoint(x: 0.5 - dx / 2, y: 0.5 - dy / 2),
      endPoint: UnitPoint(x: 0.5 + dx / 2, y: 0.5 + dy / 2))
  }

  private static func angled(_ degrees: Double, _ colors: [Color]) -> LinearGradient {
    angled(
      degrees,
      colors.enumerated().map {
        .init(color: $1, location: Double($0) / Double(max(1, colors.count - 1)))
      })
  }

  static let netWorthHero = angled(140, [
    .init(color: Color(hex: 0x2563eb), location: 0),
    .init(color: Color(hex: 0x1c3aa0), location: 0.48),
    .init(color: Color(hex: 0x141d38), location: 1.0),
  ])
  static let emiLoanHero = angled(140, [Color(hex: 0x2563eb), Color(hex: 0x141d38)])
  static let emiCardHero = angled(140, [Color(hex: 0x7a4bd0), Color(hex: 0x20182f)])
  static let dpsHero = angled(140, [Color(hex: 0x00a572), Color(hex: 0x0d2a26)])
  static let savingsHero = angled(140, [Color(hex: 0x2563eb), Color(hex: 0x141d38)])
  static let avatar = angled(135, [Color(hex: 0x2563eb), Color(hex: 0x00a572)])
}
```

- [ ] **Step 3: Consolidate the surviving components into one file**

Replace the entire `Components.swift` with the code below, then `git rm apps/ios/Phinio/Phinio/UI/DesignSystem/Components+Controls.swift`. (`HeroCard` loses its `Radii`/`Shadows`/`AmbientOrb` token references — radius default is inlined at 22, the card-level shadow is dropped since heroes now sit in list rows; `MoneyPill`, `StatTile`, `TypeBadge`, `AvatarView`, `IconTile`, `OfflineBanner` are byte-identical to their Task 3/5/7 versions.)

```swift
import SwiftUI

// Custom leaves that survive the native re-skin — pieces with no system
// equivalent: the gradient hero card, stat tiles, money/type badges, the
// gradient avatar, icon tiles, and the offline capsule.

/// Gradient hero (net worth, EMI/DPS/savings/lump-sum detail heroes) with a
/// blurred ambient orb. The one deliberate non-standard element: fixed dark
/// gradients, white content, both appearances.
struct HeroCard<Content: View>: View {
  let gradient: LinearGradient
  let orbTint: Color
  var radius: CGFloat = 22
  var orbSize: CGFloat = 200
  var orbTopOffset: CGFloat = -80
  var bottomPadding: CGFloat = 22
  @ViewBuilder let content: Content

  var body: some View {
    content
      .padding(.horizontal, 22)
      .padding(.top, 22)
      .padding(.bottom, bottomPadding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(gradient)
      .background(alignment: .topTrailing) {
        // The orb bleeds outward past the trailing edge (+40 at a .topTrailing
        // anchor moves it outward).
        Circle()
          .fill(orbTint)
          .frame(width: orbSize, height: orbSize)
          .blur(radius: 46)
          .offset(x: 40, y: orbTopOffset)
      }
      .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
  }
}

/// Grid tile (3-up on EMI/DPS detail, 2-up on Savings detail).
struct StatTile: View {
  let label: String
  let value: String
  var alignment: HorizontalAlignment = .center

  var body: some View {
    VStack(alignment: alignment, spacing: 4) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value)
        .font(.headline.monospacedDigit())
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    .padding(.vertical, 12)
    .padding(.horizontal, 10)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

/// Gain/loss capsule. `.compact` for list rows and stat cards, `.hero` for
/// placement on gradient hero cards (white on translucent white).
struct MoneyPill: View {
  enum Size { case compact, hero }

  let percent: Decimal
  var size: Size = .compact

  private var isPositive: Bool { percent >= 0 }

  private var valueText: String {
    percent.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1))) + "%"
  }

  var body: some View {
    Text("\(isPositive ? "▲" : "▼") \(valueText)")
      .font(.caption.weight(.bold).monospacedDigit())
      .foregroundStyle(size == .hero ? Color.white : (isPositive ? Color.green : Color.red))
      .padding(.horizontal, 9)
      .padding(.vertical, size == .hero ? 4 : 3)
      .background(
        size == .hero
          ? AnyShapeStyle(.white.opacity(0.18))
          : AnyShapeStyle((isPositive ? Color.green : Color.red).opacity(0.15)),
        in: .capsule)
      .accessibilityLabel(
        Text(
          "\(isPositive ? "Up" : "Down") \(percent.magnitude.formatted(.number.precision(.fractionLength(1))))%"
        ))
  }
}

/// Investment-type chip — colors from `TypePalette`, so it never disagrees
/// with the allocation donut/legend.
struct TypeBadge: View {
  let type: String  // Investment.type raw value

  var body: some View {
    Text(investmentTypeLabel(type))
      .font(.caption2.weight(.semibold))
      .foregroundStyle(TypePalette.foreground(for: type))
      .padding(.horizontal, 9)
      .padding(.vertical, 3)
      .background(
        TypePalette.background(for: type),
        in: RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

/// Circular gradient avatar with initials (toolbar 30pt, Profile 88pt).
struct AvatarView: View {
  let initials: String
  let size: CGFloat

  var body: some View {
    Circle()
      .fill(Gradients.avatar)
      .frame(width: size, height: size)
      .overlay(
        Text(initials)
          .font(.system(size: size * 0.35, weight: .bold))
          .foregroundStyle(.white)
      )
      .accessibilityHidden(true)
  }
}

/// Rounded-square backdrop behind an SF Symbol (list-row leading icons).
struct IconTile<Icon: View>: View {
  let size: CGFloat
  let radius: CGFloat
  var background: Color = Color(.tertiarySystemFill)
  @ViewBuilder let icon: Icon

  var body: some View {
    icon
      .frame(width: size, height: size)
      .background(background, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
      .accessibilityHidden(true)
  }
}

/// Connectivity capsule under the nav bar, on system material so it reads in
/// both appearances.
struct OfflineBanner: View {
  var body: some View {
    Label("Offline — changes sync when you reconnect.", systemImage: "wifi.slash")
      .font(.footnote)
      .foregroundStyle(.secondary)
      .padding(.horizontal, 14)
      .padding(.vertical, 8)
      .background(.regularMaterial, in: .capsule)
      .padding(.top, 4)
      .accessibilityElement(children: .combine)
  }
}
```

- [ ] **Step 4: Dead-reference sweep**

```bash
grep -rn "Color.surface\|onSurface\|brandPrimary\|brandSecondary\|primaryContainer\|secondaryContainer\|tertiaryContainer\|tertiaryFixedDim\|Color.error\|outlineVariant\|pillIdle\|tabIdle\|onHero\|avatarText\|Radii\.\|Shadows\.\|ShadowToken\|Glass\.\|AmbientOrb\|Layout\.\|Tracking\.\|summaryCard\|Components+Controls" apps/ios/Phinio/Phinio
```

Expected: no matches. Every hit is a leftover Modern Noir reference — convert it with the translation tables.

- [ ] **Step 5: Build + full test suite**

Run the build, then the unit-test command:

```bash
xcodebuild test -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio \
  -destination "id=$UDID" -derivedDataPath apps/ios/DerivedData \
  -only-testing:PhinioTests 2>&1 | grep -E "Test Suite|TEST"
```

Expected: `TEST SUCCEEDED` with 43 tests (44 minus the deleted `FontLoadingTests`).

- [ ] **Step 6: String Catalog sync**

The build in Step 5 extracts new string literals into `Localizable.xcstrings`. Check:

```bash
git diff --stat apps/ios/Phinio/Phinio/Localizable.xcstrings
```

Expected: the catalog gained the new keys (e.g. "Create", "Mark read", "Filter by type", "Add deposit"). If `xcodebuild` did not touch the catalog, open the project in Xcode.app and build once (⌘B) — that is the known sync path from the spec. Bengali values for the new keys are the existing follow-up for a speaker; do not machine-fill them.

- [ ] **Step 7: Full light/dark + Dynamic Type sweep**

Walk every screen in the simulator in **both** appearances: welcome → auth → priming → sync → Home (incl. empty state on a fresh account if feasible) → Profile → Activity → Notifications → Invest list → 3 details + forms + withdraw → EMI list → form → detail. Checks: no dark-painted surface in light mode, no illegible text, TypePalette badges/donut readable in light, heroes legible in both.

Then Dynamic Type at XL on Home, one form, one detail:

```bash
xcrun simctl ui "$UDID" content_size extra-extra-large
```

Expected: text scales, nothing truncates unusably. Reset with `xcrun simctl ui "$UDID" content_size medium`.

Finally one authenticated pass against production: build and run the **Release** configuration (points at `https://phinio.jnahian.me`):

```bash
xcodebuild build -project apps/ios/Phinio/Phinio.xcodeproj -scheme Phinio \
  -configuration Release -destination "id=$UDID" -derivedDataPath apps/ios/DerivedData 2>&1 | tail -3
xcrun simctl install "$UDID" apps/ios/DerivedData/Build/Products/Release-iphonesimulator/Phinio.app
xcrun simctl launch "$UDID" com.phinio.app
```

Sign in with a real account, confirm sync populates the dashboard, toggle one EMI payment and see it persist after pull-to-refresh.

- [ ] **Step 8: Commit**

```bash
git add -A apps/ios/Phinio
git commit -m "🔥 chore(ios): drop vendored fonts and Modern Noir remnants"
```

---

## Self-Review (performed while writing)

**Spec coverage:**
- §1 Appearance & tokens → Tasks 1 (unlock, AccentColor, TypePalette) and 9 (token collapse, Typography/fonts/`UIAppFonts`/`FontLoadingTests` deletion). Money `.monospacedDigit()` is baked into the font translation table.
- §2 Chrome → Task 2 (TabView, search-role create slot + interception + fallback, per-tab stacks and typed routes preserved), Task 3 (profile behind Home toolbar avatar), Tasks 5–6 (DetailHeader → nav bars, destructive actions behind toolbar Menus), all form tasks (sheets with detents where the sheet is small; full-height forms keep the default large detent).
- §3 Component mapping → every row of the spec's table has a home: cards/sections → List Sections (Tasks 3–7), CarvedTextField → Form TextFields (Task 8), NoirToggle → Toggle (Task 3), PrimaryButton → `.glassProminent` (Task 8), FilterPills/SegmentedTabs → segmented Picker + toolbar Menu (Tasks 4/6), ProgressBar → ProgressView (Tasks 4/6), skeletons → `.redacted` (Task 7), offline banner → material capsule (Task 7), kept leaves restyled (Tasks 3/5/9), heroes and Swift Charts kept.
- §4 Deletions → each task deletes what it orphans, with a grep gate; Task 9 sweeps stragglers.
- §5 Phases → Tasks 1–9 map 1:1 (phase 4 split into Tasks 4+5 for reviewability).
- §6 Testing → build+tests+dual-appearance check per task; Dynamic Type XL and the authenticated production pass in Task 9.
- §7 Risks → search-role fallback in Task 2; xcstrings sync in Task 9; light-mode palette contrast checked in Tasks 3 and 9.

**Known judgment calls (flag to the user, not blockers):** light-mode TypePalette hexes and the AccentColor light variant are eyeballed for contrast, verified visually in Tasks 3/9; the Home greeting header is replaced by a "Home" large title; the Investments count line ("3 active · 1 completed") is dropped; Profile name editing becomes save-on-submit; notifications get "Mark read" swipe only (frozen Store has no unread API).

**Type consistency:** `StatTile` loses `valueFont` in Task 5 — Task 6 (its only later consumer) uses the new signature. `DashboardView` gains `showNotifications:` in Task 3 — MainTabView call site updated in the same task. `WithdrawalRow` is defined in Task 5 Step 2 and consumed in Step 4. `CreateSheet.tint` is dropped in Task 2 — its only consumer (FabMenu) dies in the same step.




