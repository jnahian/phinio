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
  /// Centre of the tab bar's separated + slot, measured from the bottom-trailing
  /// corner of the *safe area* — the floating tab bar is positioned off that
  /// too, so this tracks it across devices better than screen coordinates would.
  /// UIKit exposes no frame for the slot, so the numbers are measured off a
  /// screenshot; the popover only has to point near the button.
  private static let createSlotTrailingInset: CGFloat = 53
  private static let createSlotBottomInset: CGFloat = 20

  @EnvironmentObject private var deepLink: DeepLinkRouter
  @EnvironmentObject private var sync: SyncEngine
  @State private var tab: AppTab = .home
  @State private var homePath = NavigationPath()
  @State private var investmentsPath = NavigationPath()
  @State private var emisPath = NavigationPath()
  @State private var showCreateMenu = false
  @State private var creating: CreateSheet?
  @State private var showNotifications = false

  /// Tab item whose symbol bounces as it becomes selected.
  private func animatedTabLabel(
    _ title: LocalizedStringKey, symbol: String, tab item: AppTab
  ) -> some View {
    Label {
      Text(title)
    } icon: {
      Image(systemName: symbol)
        .symbolEffect(.bounce, options: .nonRepeating, value: tab == item)
    }
  }

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
      Tab(value: AppTab.home) {
        NavigationStack(path: $homePath) {
          DashboardView(showNotifications: $showNotifications) { creating = $0 }
            .navigationDestination(for: EmiRoute.self) { EmiDetailView(emiId: $0.id) }
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
            .navigationDestination(for: ProfileRoute.self) { _ in ProfileView() }
            .navigationDestination(for: ActivityRoute.self) { _ in ActivityView() }
        }
      } label: {
        animatedTabLabel("Home", symbol: "house", tab: .home)
      }

      Tab(value: AppTab.invest) {
        NavigationStack(path: $investmentsPath) {
          InvestmentsListView()
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
        }
      } label: {
        animatedTabLabel("Invest", symbol: "chart.line.uptrend.xyaxis", tab: .invest)
      }

      Tab(value: AppTab.emis) {
        NavigationStack(path: $emisPath) {
          EmiListView()
            .navigationDestination(for: EmiRoute.self) { EmiDetailView(emiId: $0.id) }
        }
      } label: {
        animatedTabLabel("EMIs", symbol: "creditcard", tab: .emis)
      }

      // Off-label (spec §2): the search role renders as the separated circular
      // trailing slot; plus icon + "Add" label restyle it as Create. Fallback if
      // the icon/label overrides don't take: delete `role: .search` — same
      // interception UX, loses the separated styling.
      Tab("Add", systemImage: "plus", value: AppTab.create, role: .search) {
        Color.clear
      }
    }
    // A popover needs a view to point at, and the + is a `Tab` whose content is
    // `Color.clear` — nothing to anchor to. This 1×1 spacer sits over the tab
    // bar's separated trailing slot purely as the attachment point; it never
    // takes a hit, the Tab still handles the tap.
    .overlay(alignment: .bottomTrailing) {
      Color.clear
        .frame(width: 1, height: 1)
        // `.popover` before the padding, not after: it anchors to the bounds of
        // whatever it is attached to, and a padded 1×1 spacer is a 54pt-wide
        // rect whose centre sits well right of the button.
        //
        // `.bottom` puts the arrow on the popover's bottom edge, i.e. the menu
        // opens upward. `.top` would open it downward, off the screen.
        .popover(isPresented: $showCreateMenu, arrowEdge: .bottom) {
          CreateMenuPopover { option in
            showCreateMenu = false
            tab = option.owningTab
            creating = option
          }
        }
        .padding(.trailing, Self.createSlotTrailingInset)
        .padding(.bottom, Self.createSlotBottomInset)
        .allowsHitTesting(false)
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

/// The four create flows as a popover off the tab bar's + slot. Four rows and a
/// Cancel button don't earn a half-screen sheet — and `.presentationCompact-
/// Adaptation(.popover)` is required, or iPhone silently re-adapts it back into
/// one.
struct CreateMenuPopover: View {
  let onSelect: (CreateSheet) -> Void

  var body: some View {
    VStack(spacing: 0) {
      ForEach(Array(CreateSheet.allCases.enumerated()), id: \.element) { index, option in
        if index > 0 { Divider().padding(.leading, 54) }
        row(option)
      }
    }
    .frame(width: 232)
    .presentationCompactAdaptation(.popover)
  }

  private func row(_ option: CreateSheet) -> some View {
    Button {
      onSelect(option)
    } label: {
      HStack(spacing: 12) {
        Image(systemName: option.symbol)
          .font(.system(size: 16))
          .foregroundStyle(.tint)
          .frame(width: 26)
        Text(option.label)
          .font(.body)
          .foregroundStyle(.primary)
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 16)
      .frame(height: 50)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
  }
}
