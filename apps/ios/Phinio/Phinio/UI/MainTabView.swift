import SwiftData
import SwiftUI

struct EmiRoute: Hashable { let id: String }
struct InvestmentRoute: Hashable { let id: String }
struct ProfileRoute: Hashable {}
struct ActivityRoute: Hashable {}

struct MainTabView: View {
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @State private var tab: AppTab = .home
  @State private var homePath = NavigationPath()
  @State private var investmentsPath = NavigationPath()
  @State private var emisPath = NavigationPath()
  @State private var fabOpen = false
  @State private var creating: CreateSheet?
  @State private var showNotifications = false

  var body: some View {
    // Three always-instantiated stacks switched by opacity/zIndex — `if tab == …`
    // would tear each stack down and lose its back stack on every switch.
    ZStack {
      stack(.home, path: $homePath) {
        VStack(spacing: 0) {
          HomeTopBar(showNotifications: $showNotifications)
          DashboardView()
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: EmiRoute.self) { EmiDetailView(emiId: $0.id) }
        .navigationDestination(for: InvestmentRoute.self) {
          InvestmentDetailRouter(investmentId: $0.id)
        }
        .navigationDestination(for: ProfileRoute.self) { _ in ProfileView() }
        .navigationDestination(for: ActivityRoute.self) { _ in ActivityView() }
      }

      stack(.invest, path: $investmentsPath) {
        InvestmentsListView()
          .navigationDestination(for: InvestmentRoute.self) {
            InvestmentDetailRouter(investmentId: $0.id)
          }
      }

      stack(.emis, path: $emisPath) {
        EmiListView()
          .navigationDestination(for: EmiRoute.self) { EmiDetailView(emiId: $0.id) }
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

  @ViewBuilder
  private func stack<Root: View>(
    _ which: AppTab, path: Binding<NavigationPath>, @ViewBuilder root: () -> Root
  ) -> some View {
    let active = tab == which
    // The ZStack wrapper is load-bearing: `.accessibilityHidden` applied
    // directly to a NavigationStack does not hide its subtree, so VoiceOver
    // (and XCUITest) still walked all three tabs' chrome.
    ZStack {
      NavigationStack(path: path) {
        root()
          // Applied before the bar's safeAreaInset so the bar and FAB draw above
          // the scrim, matching the comp's z-order (scrim 44, bar 45).
          .overlay {
            if fabOpen {
              FabMenu(isOpen: $fabOpen) { option in
                fabOpen = false
                tab = option.owningTab
                creating = option
              }
            }
          }
          .safeAreaInset(edge: .bottom) {
            NoirTabBar(selection: $tab, fabOpen: $fabOpen)
          }
          .animation(.easeOut(duration: 0.18), value: fabOpen)
          .accessibilityHidden(!active)
      }
    }
    .modifier(InactiveStack(inactive: !active))
    .zIndex(active ? 1 : 0)
  }
}

/// Hides an inactive tab's stack without unmounting it. `.hidden()` is the only
/// modifier that actually drops the subtree from the accessibility tree —
/// `.accessibilityHidden(true)` on a NavigationStack (or a wrapper around one)
/// is silently ignored, leaving all three tabs' content visible to VoiceOver.
private struct InactiveStack: ViewModifier {
  let inactive: Bool

  func body(content: Content) -> some View {
    if inactive {
      content.hidden()
    } else {
      content
    }
  }
}

/// Greeting + name, notification bell with unread badge, avatar → Profile.
/// Part of the shell (comp has no nav bar on Home); Phase 3 owns what sits below.
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

  // Kept from DashboardView's old toolbar, which the custom top bar replaces.
  @ViewBuilder private var syncBadge: some View {
    switch sync.state {
    case .syncing: ProgressView().controlSize(.small)
    case .offline: Image(systemName: "wifi.slash").foregroundStyle(Color.onSurfaceMuted)
    case .idle, .unauthorized: EmptyView()
    }
  }
}
