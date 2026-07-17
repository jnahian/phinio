import SwiftUI

/// First-launch flow (spec §5): welcome pages → auth → notification priming
/// → initial sync. Every step except auth is skippable. `hasOnboarded`
/// flips once the flow completes so relaunches go straight to the tabs.
struct OnboardingView: View {
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @AppStorage("hasOnboarded") private var hasOnboarded = false

  enum Stage { case welcome, auth, priming, syncing }
  @State private var stage: Stage

  init(startAt stage: Stage = .welcome) {
    _stage = State(initialValue: stage)
  }

  var body: some View {
    switch stage {
    case .welcome:
      WelcomePages { stage = .auth }
    case .auth:
      AuthStepView { stage = .priming }
    case .priming:
      PrimingStep {
        stage = .syncing
      }
    case .syncing:
      InitialSyncStep { hasOnboarded = true }
    }
  }
}

private struct WelcomePages: View {
  let done: () -> Void
  @State private var page = 0

  private static let pages: [(symbol: String, title: String, text: String)] = [
    ("chart.line.uptrend.xyaxis", "Track investments",
     "Savings, DPS, stocks, gold and more — with gains at a glance."),
    ("creditcard", "Manage EMIs",
     "Full amortization schedules, payment tracking and reminders."),
    ("wifi.slash", "Works offline",
     "Everything works without a connection and syncs when you're back."),
  ]

  var body: some View {
    VStack {
      TabView(selection: $page) {
        ForEach(Array(Self.pages.enumerated()), id: \.offset) { i, p in
          VStack(spacing: 16) {
            Image(systemName: p.symbol)
              .font(.system(size: 64))
              .foregroundStyle(.tint)
            Text(p.title).font(.title.bold())
            Text(p.text)
              .multilineTextAlignment(.center)
              .foregroundStyle(.secondary)
              .padding(.horizontal, 32)
          }
          .tag(i)
        }
      }
      .tabViewStyle(.page)
      Button(page == Self.pages.count - 1 ? "Get started" : "Skip") { done() }
        .buttonStyle(.borderedProminent)
        .padding(.bottom, 32)
    }
  }
}

private struct PrimingStep: View {
  let done: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      Spacer()
      Image(systemName: "bell.badge")
        .font(.system(size: 64)).foregroundStyle(.tint)
      Text("Payment reminders").font(.title.bold())
      Text("Get notified before EMI payments and DPS installments are due, so nothing slips.")
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
        .padding(.horizontal, 32)
      Spacer()
      Button("Enable reminders") {
        Task {
          await PushManager.requestAndRegister()
          done()
        }
      }
      .buttonStyle(.borderedProminent)
      Button("Maybe later") { done() }
        .padding(.bottom, 32)
    }
  }
}

private struct InitialSyncStep: View {
  @EnvironmentObject private var sync: SyncEngine
  let done: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      ProgressView().controlSize(.large)
      Text("Getting your data…").foregroundStyle(.secondary)
      if sync.state == .offline {
        Text("Couldn't reach the server — you can start offline.")
          .font(.caption).foregroundStyle(.secondary)
        Button("Continue") { done() }
      }
    }
    .task {
      await sync.syncNow()
      done() // idle or offline — either way the app is usable
    }
  }
}
