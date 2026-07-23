import SwiftData
import SwiftUI

/// Presented as a sheet from the Home bell.
struct NotificationsView: View {
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @Query private var all: [AppNotification]

  /// Unread first, then newest — the sort SwiftData can't express in one
  /// descriptor, so it happens here.
  private var notifications: [AppNotification] {
    all.sorted {
      ($0.readAt == nil ? 0 : 1, $1.createdAt) < ($1.readAt == nil ? 0 : 1, $0.createdAt)
    }
  }

  private var hasUnread: Bool { all.contains { $0.readAt == nil } }

  var body: some View {
    List {
      if notifications.isEmpty {
        ContentUnavailableView(
          "No notifications", systemImage: "bell",
          description: Text("Payment reminders will show up here."))
          .listRowBackground(Color.clear)
      } else {
        ForEach(notifications) { row($0) }
      }
    }
    .navigationTitle("Notifications")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        if hasUnread {
          Button("Mark all read") {
            try? Store(context: context).markAllNotificationsRead()
            Task { await sync.syncNow() }
          }
        }
      }
      ToolbarItem(placement: .confirmationAction) {
        Button("Done") { dismiss() }
      }
    }
  }

  private func row(_ n: AppNotification) -> some View {
    let unread = n.readAt == nil
    return Button {
      if unread {
        try? Store(context: context).markNotificationRead(n)
        Task { await sync.syncNow() }
      }
      if let link = n.link, let parsed = DeepLink.parse(link) {
        deepLink.pending = parsed
        dismiss()
      }
    } label: {
      HStack(alignment: .top, spacing: 12) {
        Circle()
          .fill(unread ? Color.accentColor : .clear)
          .frame(width: 8, height: 8)
          .padding(.top, 6)
        VStack(alignment: .leading, spacing: 3) {
          Text(n.title)
            .font(.body.weight(unread ? .semibold : .regular))
            .foregroundStyle(unread ? Color.primary : Color.secondary)
          Text(n.body)
            .font(.footnote).foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
          Text(n.createdAt, format: .relative(presentation: .named))
            .font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    // Store has no mark-unread API (frozen layer) — swipe offers Mark read only.
    .swipeActions {
      if unread {
        Button("Mark read") {
          try? Store(context: context).markNotificationRead(n)
          Task { await sync.syncNow() }
        }
        .tint(.accentColor)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(unread ? "Unread" : "Read")
  }
}
