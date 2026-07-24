import PhotosUI
import SwiftData
import SwiftUI
import UIKit
import UserNotifications

struct ProfileView: View {
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @EnvironmentObject private var avatars: AvatarStore
  @Query private var profiles: [Profile]
  @Query(sort: \SyncIssue.occurredAt, order: .reverse)
  private var issues: [SyncIssue]

  @State private var fullName = ""
  @State private var notifStatus: UNAuthorizationStatus = .notDetermined
  @State private var confirmSignOut = false
  @State private var seeded = false
  @State private var pickedPhoto: PhotosPickerItem?
  @State private var confirmRemovePhoto = false
  /// A flag, not the message: `Text(someString)` is not localized, so holding
  /// the copy here would keep it out of the string catalog.
  @State private var photoFailed = false

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
          avatarPicker
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
        if photoFailed {
          Text("Failed to update photo.").foregroundStyle(.red)
        } else if !nameIsValid {
          Text("Name needs at least 2 characters.")
        }
      }

      Section {
        Picker(selection: currencyBinding) {
          Text("৳ BDT").tag("BDT")
          Text("$ USD").tag("USD")
        } label: {
          Label("Currency", systemImage: "banknote")
        }
        Picker(selection: languageBinding) {
          Text("English").tag("en")
          Text("বাংলা").tag("bn")
        } label: {
          Label("Language", systemImage: "globe")
        }
        Toggle(isOn: remindersBinding) {
          Label {
            Text("Payment reminders")
          } icon: {
            // Swaps to the badged bell once reminders are on, so the row's
            // icon carries the state as well as the switch.
            Image(systemName: remindersBinding.wrappedValue ? "bell.badge" : "bell")
              .contentTransition(.symbolEffect(.replace))
          }
        }
      } header: {
        Text("Preferences")
      } footer: {
        Text(reminderHelp)
      }

      Section("Account") {
        NavigationLink(value: ActivityRoute()) {
          Label("Activity history", systemImage: "clock.arrow.circlepath")
        }
        Button {
          Task { await sync.syncNow() }
        } label: {
          LabeledContent {
            Text(String(describing: sync.state).capitalized)
          } label: {
            Label {
              Text("Sync now")
            } icon: {
              Image(systemName: "arrow.triangle.2.circlepath")
                .symbolEffect(.rotate, options: .repeating, isActive: sync.state == .syncing)
                // The row's `.foregroundStyle(.primary)` (which keeps the title
                // from going blue) would otherwise wash the icon out too, and
                // it would be the only untinted glyph in the section.
                .foregroundStyle(.tint)
            }
          }
        }
        .foregroundStyle(.primary)
        Button(role: .destructive) { confirmSignOut = true } label: {
          Label {
            Text("Sign out")
          } icon: {
            // `.destructive` reddens the title but leaves the icon on the app
            // tint; match it explicitly.
            Image(systemName: "rectangle.portrait.and.arrow.right")
              .foregroundStyle(.red)
          }
        }
      }

      if !issues.isEmpty {
        Section {
          ForEach(issues) { issue in
            Label {
              VStack(alignment: .leading, spacing: 2) {
                Text(issue.message)
                  .font(.subheadline)
                Text(issue.occurredAt, format: .relative(presentation: .named))
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            } icon: {
              Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
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
    .task {
      await refreshNotifStatus()
      await avatars.refresh()
    }
    .onChange(of: pickedPhoto) { _, item in
      guard let item else { return }
      pickedPhoto = nil
      Task { await upload(item) }
    }
    .confirmationDialog(
      "Remove photo?", isPresented: $confirmRemovePhoto, titleVisibility: .visible
    ) {
      Button("Remove", role: .destructive) {
        Task { await runPhotoUpdate { try await avatars.remove() } }
      }
    } message: {
      Text("Your initial avatar will be shown instead.")
    }
    .confirmationDialog(
      "Sign out? Local data on this device will be erased.",
      isPresented: $confirmSignOut, titleVisibility: .visible
    ) {
      Button("Sign out", role: .destructive) { signOut() }
    }
  }

  // MARK: Photo

  private var avatarPicker: some View {
    // Read the store's state here rather than inside the builder closures —
    // those are nonisolated, and touching a @MainActor property from one is an
    // error under the Swift 6 language mode.
    let photo = avatars.image
    let uploading = avatars.isUploading
    return PhotosPicker(
      selection: $pickedPhoto, matching: .images, photoLibrary: .shared()
    ) {
      AvatarView(
        initials: initials, size: 88,
        colorKey: profile?.id ?? "", photo: photo
      )
      .overlay {
        if uploading {
          ZStack {
            Circle().fill(.black.opacity(0.45))
            ProgressView().tint(.white)
          }
        }
      }
      .overlay(alignment: .bottomTrailing) {
        Image(systemName: "camera.fill")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(.secondary)
          .frame(width: 28, height: 28)
          .background(Color(.secondarySystemGroupedBackground), in: .circle)
          .overlay(Circle().stroke(Color(.systemGroupedBackground), lineWidth: 2))
          .offset(x: 2, y: 2)
      }
    }
    .disabled(uploading)
    .accessibilityLabel("Change profile photo")
    // Long-press rather than a second row: removal is rare, and the picker
    // already owns the tap.
    .contextMenu {
      if photo != nil {
        Button("Remove photo", systemImage: "trash", role: .destructive) {
          confirmRemovePhoto = true
        }
      }
    }
  }

  private func upload(_ item: PhotosPickerItem) async {
    await runPhotoUpdate {
      guard let data = try await item.loadTransferable(type: Data.self),
            let picked = UIImage(data: data)
      else { throw APIError.decoding }
      try await avatars.upload(picked)
    }
  }

  private func runPhotoUpdate(_ work: () async throws -> Void) async {
    do {
      try await work()
      photoFailed = false
    } catch {
      photoFailed = true
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
    avatars.clear()
    auth.signOut(container: context.container)
  }
}
