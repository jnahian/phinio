import SwiftUI

struct EmiRoute: Hashable { let id: String }
struct InvestmentRoute: Hashable { let id: String }

struct MainTabView: View {
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @State private var tab: Tab = .dashboard
  @State private var investmentsPath = NavigationPath()
  @State private var emisPath = NavigationPath()

  enum Tab { case dashboard, investments, emis, activity }

  var body: some View {
    TabView(selection: $tab) {
      SwiftUI.Tab("Dashboard", systemImage: "chart.pie", value: Tab.dashboard) {
        NavigationStack {
          DashboardView()
            .navigationDestination(for: EmiRoute.self) {
              EmiDetailView(emiId: $0.id)
            }
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
        }
      }
      SwiftUI.Tab("Investments", systemImage: "banknote", value: Tab.investments) {
        NavigationStack(path: $investmentsPath) {
          InvestmentsListView()
            .navigationDestination(for: InvestmentRoute.self) {
              InvestmentDetailRouter(investmentId: $0.id)
            }
        }
      }
      SwiftUI.Tab("EMIs", systemImage: "creditcard", value: Tab.emis) {
        NavigationStack(path: $emisPath) {
          EmiListView()
            .navigationDestination(for: EmiRoute.self) {
              EmiDetailView(emiId: $0.id)
            }
        }
      }
      SwiftUI.Tab("Activity", systemImage: "clock.arrow.circlepath", value: Tab.activity) {
        NavigationStack { ActivityView() }
      }
    }
    .onChange(of: deepLink.pending) { _, link in
      guard let link else { return }
      deepLink.pending = nil
      switch link {
      case .emi(let id):
        tab = .emis
        emisPath.append(EmiRoute(id: id))
      case .dps(let id):
        tab = .investments
        investmentsPath.append(InvestmentRoute(id: id))
      }
    }
  }
}
