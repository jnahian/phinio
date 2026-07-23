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
  @State private var authMode: AuthStepView.Mode = .signIn

  init(startAt stage: Stage = .welcome) {
    _stage = State(initialValue: stage)
  }

  var body: some View {
    switch stage {
    case .welcome:
      GetStartedView(
        onSignUp: { authMode = .signUp; stage = .auth },
        onLogin: { authMode = .signIn; stage = .auth })
    case .auth:
      AuthStepView(startMode: authMode) { stage = .priming }
    case .priming:
      PrimingStep {
        stage = .syncing
      }
    case .syncing:
      InitialSyncStep { hasOnboarded = true }
    }
  }
}

private struct PrimingStep: View {
  let done: () -> Void

  var body: some View {
    ZStack {
      Color.surface.ignoresSafeArea()
      VStack(spacing: 16) {
        Spacer()
        IconTile(size: 88, radius: 26, background: Color.brandPrimary.opacity(0.10)) {
          Image(systemName: "bell.badge")
            .font(.system(size: 40))
            .foregroundStyle(Color.brandPrimary)
        }
        Text("Payment reminders")
          .font(.sectionTitle).foregroundStyle(Color.onSurface)
          .padding(.top, 8)
        Text("Get notified before EMI payments and DPS installments are due, so nothing slips.")
          .font(.body)
          .multilineTextAlignment(.center)
          .foregroundStyle(Color.onSurfaceVariant)
        Spacer()
        PrimaryButton("Enable reminders") {
          Task {
            await PushManager.requestAndRegister()
            done()
          }
        }
        TextButton("Maybe later", action: done)
      }
      .padding(.horizontal, 36)
      .padding(.bottom, 40)
    }
  }
}

private struct InitialSyncStep: View {
  @EnvironmentObject private var sync: SyncEngine
  let done: () -> Void

  var body: some View {
    ZStack {
      Color.surface.ignoresSafeArea()
      VStack(spacing: 14) {
        ProgressView().controlSize(.large).tint(Color.brandPrimary)
        Text("Getting your data…")
          .font(.body).foregroundStyle(Color.onSurfaceVariant)
        if sync.state == .offline {
          Text("Couldn't reach the server — you can start offline.")
            .font(.caption).foregroundStyle(Color.onSurfaceMuted)
          TextButton("Continue", action: done)
        }
      }
      .padding(.horizontal, 36)
    }
    .task {
      await sync.syncNow()
      done()  // idle or offline — either way the app is usable
    }
  }
}
