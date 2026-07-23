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
  @State private var currency = "BDT"
  @State private var language = "en"
  @State private var notifStatus: UNAuthorizationStatus = .notDetermined
  @State private var confirmSignOut = false
  @State private var seeded = false

  private var profile: Profile? { profiles.first }
  private var dirty: Bool {
    guard let p = profile else { return false }
    return fullName != p.fullName || currency != p.preferredCurrency
      || language != p.preferredLanguage
  }

  var body: some View {
    Form {
      Section("Profile") {
        TextField("Full name", text: $fullName)
        Picker("Currency", selection: $currency) {
          Text("BDT").tag("BDT")
          Text("USD").tag("USD")
        }
        Picker("Language", selection: $language) {
          Text("English").tag("en")
          Text("বাংলা").tag("bn")
        }
        if dirty {
          Button("Save changes") { saveProfile() }
            .disabled(Validate.name(fullName, max: 120) == nil
                      || fullName.trimmingCharacters(in: .whitespaces).count < 2)
        }
      }

      Section("Notifications") {
        switch notifStatus {
        case .authorized, .provisional:
          Label("Reminders enabled", systemImage: "bell.badge")
        case .denied:
          // Re-prime path per spec §5: once denied, only Settings can enable.
          Button("Enable in Settings…") {
            if let url = URL(string: UIApplication.openSettingsURLString) {
              UIApplication.shared.open(url)
            }
          }
        default:
          Button("Enable reminders") {
            Task {
              await PushManager.requestAndRegister()
              await refreshNotifStatus()
            }
          }
        }
      }

      Section {
        LabeledContent("Status") {
          Text(String(describing: sync.state).capitalized)
        }
        Button("Sync now") { Task { await sync.syncNow() } }
        if !issues.isEmpty {
          ForEach(issues) { issue in
            VStack(alignment: .leading) {
              Text(issue.message).font(.callout)
              Text(issue.occurredAt, format: .relative(presentation: .named))
                .font(.caption).foregroundStyle(.secondary)
            }
            .swipeActions {
              Button("Dismiss", role: .destructive) {
                context.delete(issue)
                try? context.save()
              }
            }
          }
        }
      } header: {
        Text("Sync")
      } footer: {
        if !issues.isEmpty {
          Text("These changes were rejected by the server and undone by the last sync.")
        }
      }

      Section {
        // The Activity tab is gone (comp has 3 tabs) — reached from here now.
        NavigationLink(value: ActivityRoute()) { Text("Activity history") }
      }

      Section {
        Button("Sign out", role: .destructive) { confirmSignOut = true }
      }
    }
    .navigationTitle("Profile")
    // Seed exactly once, when the profile first becomes available — @Query
    // loads async, so it may arrive after the view appears. Guarding on
    // `seeded` (not just onAppear) avoids showing stale defaults, and firing
    // once avoids clobbering in-progress edits when a later sync updates it.
    .onChange(of: profile?.id, initial: true) { _, _ in
      guard !seeded, let p = profile else { return }
      seeded = true
      fullName = p.fullName
      currency = p.preferredCurrency
      language = p.preferredLanguage
    }
    .task { await refreshNotifStatus() }
    .confirmationDialog(
      "Sign out? Local data on this device will be erased.",
      isPresented: $confirmSignOut, titleVisibility: .visible) {
      Button("Sign out", role: .destructive) { signOut() }
    }
  }

  private func saveProfile() {
    guard let p = profile else { return }
    try? Store(context: context).updateProfile(
      p, fullName: fullName.trimmingCharacters(in: .whitespaces),
      preferredCurrency: currency, preferredLanguage: language)
    Task { await sync.syncNow() }
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
