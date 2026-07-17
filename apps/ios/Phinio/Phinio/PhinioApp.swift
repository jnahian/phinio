import SwiftData
import SwiftUI

@main
struct PhinioApp: App {
  @Environment(\.scenePhase) private var scenePhase

  private let container: ModelContainer
  /// Plain `let`, not @StateObject — Task 14's AppDelegate needs a reference
  /// it can grab in `init()`.
  private let deepLinkRouter = DeepLinkRouter()
  @StateObject private var auth: AuthManager
  @StateObject private var sync: SyncEngine
  @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  init() {
    let container = try! makeModelContainer()
    let client = APIClient()
    self.container = container
    _auth = StateObject(wrappedValue: AuthManager(client: client))
    _sync = StateObject(wrappedValue: SyncEngine(transport: client, container: container))
    AppDelegate.router = deepLinkRouter
  }

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(auth)
        .environmentObject(sync)
        .environmentObject(deepLinkRouter)
    }
    .modelContainer(container)
    .onChange(of: scenePhase) { _, phase in
      if phase == .active, auth.isAuthenticated {
        Task { await sync.syncNow() }
      }
    }
  }
}

struct RootView: View {
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @Environment(\.modelContext) private var context
  @AppStorage("hasOnboarded") private var hasOnboarded = false

  var body: some View {
    if auth.isAuthenticated && hasOnboarded {
      MainTabView()
        .onChange(of: sync.state) { _, state in
          if state == .unauthorized {
            auth.signOut(container: context.container)
          }
        }
    } else if auth.isAuthenticated {
      // Signed in mid-onboarding (or flag lost): resume at priming.
      OnboardingView(startAt: .priming)
    } else {
      // Post-sign-out relaunches skip the welcome pages.
      OnboardingView(startAt: hasOnboarded ? .auth : .welcome)
    }
  }
}
