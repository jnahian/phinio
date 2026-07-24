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
