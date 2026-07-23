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
