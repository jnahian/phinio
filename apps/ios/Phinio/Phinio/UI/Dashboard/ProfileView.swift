import SwiftData
import SwiftUI
import UIKit
import UserNotifications

struct ProfileView: View {
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @Query private var profiles: [Profile]
  @Query(sort: \SyncIssue.occurredAt, order: .reverse)
  private var issues: [SyncIssue]

  @State private var fullName = ""
  @State private var editingName = false
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

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        header
        identity
        SectionLabel("Preferences")
          .padding(.horizontal, Layout.screenHorizontalPadding + 4)
          .padding(.bottom, 10)
        currencyCard.padding(.horizontal, Layout.screenHorizontalPadding)
        languageCard
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)
        remindersCard
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)

        SectionLabel("Account")
          .padding(.top, Layout.sectionGap)
          .padding(.horizontal, Layout.screenHorizontalPadding + 4)
          .padding(.bottom, 10)
        accountCard.padding(.horizontal, Layout.screenHorizontalPadding)

        if !issues.isEmpty {
          SectionLabel("Sync issues")
            .padding(.top, Layout.sectionGap)
            .padding(.horizontal, Layout.screenHorizontalPadding + 4)
            .padding(.bottom, 10)
          issuesCard.padding(.horizontal, Layout.screenHorizontalPadding)
        }
      }
      .padding(.bottom, 40)
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .toolbar(.hidden, for: .navigationBar)
    // Seed exactly once, when the profile first becomes available — @Query
    // loads async, so it may arrive after the view appears. Guarding on
    // `seeded` (not just onAppear) avoids showing stale defaults, and firing
    // once avoids clobbering in-progress edits when a later sync updates it.
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

  private var header: some View {
    HStack(spacing: 12) {
      Button { dismiss() } label: {
        Image(systemName: "chevron.left")
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(Color.brandPrimary)
          .frame(width: 40, height: 40)
          .background(Color.brandPrimary.opacity(0.08), in: .circle)
          .contentShape(.circle)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Back")
      Text("Profile")
        .font(.screenTitle).tracking(Tracking.screenTitle)
        .foregroundStyle(Color.onSurface)
      Spacer()
    }
    .padding(.horizontal, Layout.screenHorizontalPadding)
    .padding(.top, 4)
    .padding(.bottom, 20)
  }

  /// Comp shows an email under the name. The v1 API's profile payload has no
  /// email (it lives on the Better Auth user, not Profile), so there is nothing
  /// to render — omitted rather than faked.
  private var identity: some View {
    VStack(spacing: 12) {
      AvatarView(initials: initials, size: 88)
      if editingName {
        VStack(spacing: 10) {
          CarvedTextField(placeholder: "Full name", text: $fullName)
          HStack(spacing: 10) {
            Button("Cancel") {
              fullName = profile?.fullName ?? ""
              editingName = false
            }
            .font(.rowLabel(14))
            .foregroundStyle(Color.onSurfaceVariant)
            .frame(maxWidth: .infinity, minHeight: 44)
            Button("Save") { saveName() }
              .font(.rowLabel(14))
              .foregroundStyle(Color.onHero)
              .frame(maxWidth: .infinity, minHeight: 44)
              .background(
                Color.primaryContainer,
                in: RoundedRectangle(cornerRadius: Radii.input, style: .continuous))
              .disabled(!nameIsValid)
              .opacity(nameIsValid ? 1 : 0.5)
          }
        }
        .padding(.horizontal, Layout.screenHorizontalPadding)
      } else {
        Button {
          fullName = profile?.fullName ?? ""
          editingName = true
        } label: {
          HStack(spacing: 8) {
            Text(profile?.fullName ?? "")
              .font(.displayName).foregroundStyle(Color.onSurface)
            Image(systemName: "pencil")
              .font(.system(size: 14))
              .foregroundStyle(Color.brandPrimary)
          }
          .frame(minHeight: 44)
          .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Edit name")
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.bottom, 24)
  }

  private var nameIsValid: Bool {
    Validate.name(fullName, min: 2) != nil
  }

  // MARK: Preferences

  private var currencyCard: some View {
    prefCard(title: "Currency") {
      HStack(spacing: 10) {
        tonalTile("৳ BDT", "Bangladeshi Taka", selected: currency == "BDT") {
          save(currency: "BDT", language: language)
        }
        tonalTile("$ USD", "US Dollar", selected: currency == "USD") {
          save(currency: "USD", language: language)
        }
      }
    }
  }

  private var languageCard: some View {
    prefCard(title: "Language") {
      HStack(spacing: 10) {
        tonalTile("English", "Default", selected: language == "en") {
          save(currency: currency, language: "en")
        }
        tonalTile("বাংলা", "Bengali", selected: language == "bn") {
          save(currency: currency, language: "bn")
        }
      }
    }
  }

  private func prefCard<Content: View>(
    title: String, @ViewBuilder content: () -> Content
  ) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(title).font(.body).foregroundStyle(Color.onSurfaceVariant)
      content()
    }
    .padding(16)
    .background(Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
  }

  private func tonalTile(
    _ title: String, _ subtitle: String, selected: Bool, action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      VStack(alignment: .leading, spacing: 3) {
        Text(title).font(.custom("Manrope-Bold", size: 18))
        Text(subtitle).font(.meta).opacity(0.7)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(14)
      .foregroundStyle(selected ? Color.brandPrimary : Color.onSurfaceVariant)
      .background(
        selected ? Color.primaryContainer.opacity(0.18) : Color.surfaceLowest,
        in: RoundedRectangle(cornerRadius: Radii.currencyTile, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: Radii.currencyTile, style: .continuous)
          .strokeBorder(
            selected ? Color.brandPrimary.opacity(0.4) : .clear, lineWidth: 0.5))
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
  }

  /// Three permission states get distinct copy (brief §5.9). iOS cannot revoke
  /// authorization programmatically, so switching off an authorized toggle —
  /// like switching on a denied one — hands off to Settings.
  private var remindersCard: some View {
    let isOn = notifStatus == .authorized || notifStatus == .provisional
    return HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        Text("Payment reminders").font(.rowLabel(14)).foregroundStyle(Color.onSurface)
        Text(reminderHelp).font(.caption).foregroundStyle(Color.onSurfaceMuted)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      Toggle("Payment reminders", isOn: Binding(
        get: { isOn },
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
        }))
        .toggleStyle(.noir)
        .labelsHidden()
    }
    .padding(16)
    .background(Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
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

  // MARK: Account

  private var accountCard: some View {
    SectionGroup {
      NavigationLink(value: ActivityRoute()) {
        NavRow(title: "Activity history")
      }
      .buttonStyle(.plain)

      Button { Task { await sync.syncNow() } } label: {
        HStack {
          Text("Sync now").font(.navRowLabel).foregroundStyle(Color.onSurface)
          Spacer()
          Text(String(describing: sync.state).capitalized)
            .font(.caption).foregroundStyle(Color.onSurfaceMuted)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(minHeight: 44)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)

      Rectangle().fill(Color.outlineVariant.opacity(0.5))
        .frame(height: 0.5).padding(.leading, 16)

      Button { confirmSignOut = true } label: {
        HStack(spacing: 12) {
          Image(systemName: "rectangle.portrait.and.arrow.right")
            .font(.system(size: 16))
            .foregroundStyle(Color.error)
          Text("Sign out").font(.rowLabel(15)).foregroundStyle(Color.error)
          Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(minHeight: 44)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
    }
  }

  private var issuesCard: some View {
    SectionGroup {
      VStack(alignment: .leading, spacing: 0) {
        ForEach(issues) { issue in
          VStack(alignment: .leading, spacing: 2) {
            Text(issue.message).font(.body).foregroundStyle(Color.onSurface)
            Text(issue.occurredAt, format: .relative(presentation: .named))
              .font(.meta).foregroundStyle(Color.onSurfaceMuted)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 16)
          .padding(.vertical, 12)
          .swipeActions {
            Button("Dismiss", role: .destructive) {
              context.delete(issue)
              try? context.save()
            }
          }
        }
        Text("These changes were rejected by the server and undone by the last sync.")
          .font(.meta).foregroundStyle(Color.onSurfaceMuted)
          .padding(.horizontal, 16)
          .padding(.bottom, 12)
      }
      .padding(.vertical, 6)
    }
  }

  // MARK: Actions

  private func saveName() {
    guard let p = profile, nameIsValid else { return }
    try? Store(context: context).updateProfile(
      p, fullName: fullName.trimmingCharacters(in: .whitespaces),
      preferredCurrency: p.preferredCurrency, preferredLanguage: p.preferredLanguage)
    editingName = false
    Task { await sync.syncNow() }
  }

  /// Currency and language apply immediately — every formatted amount re-renders
  /// from the profile, so there is nothing to "save".
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
