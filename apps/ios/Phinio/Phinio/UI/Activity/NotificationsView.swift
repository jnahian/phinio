import SwiftData
import SwiftUI

/// Bell icon with the local unread count — reused by the Activity toolbar.
struct NotificationBell: View {
  @Query(filter: #Predicate<AppNotification> { $0.readAt == nil })
  private var unread: [AppNotification]

  var body: some View {
    Image(systemName: "bell")
      .badge(unread.count) // falls back gracefully outside a List
      .overlay(alignment: .topTrailing) {
        if !unread.isEmpty {
          Circle().fill(.red).frame(width: 8, height: 8).offset(x: 2, y: -2)
        }
      }
  }
}

struct NotificationsView: View {
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @Query(sort: \AppNotification.createdAt, order: .reverse)
  private var notifications: [AppNotification]

  var body: some View {
    List {
      ForEach(notifications) { n in
        Button {
          if n.readAt == nil {
            try? Store(context: context).markNotificationRead(n)
            Task { await sync.syncNow() }
          }
          if let link = n.link, let parsed = DeepLink.parse(link) {
            deepLink.pending = parsed
          }
        } label: {
          HStack(alignment: .top) {
            if n.readAt == nil {
              Circle().fill(.blue).frame(width: 8, height: 8).padding(.top, 6)
            }
            VStack(alignment: .leading, spacing: 2) {
              Text(n.title).fontWeight(n.readAt == nil ? .semibold : .regular)
              Text(n.body).font(.callout).foregroundStyle(.secondary)
              Text(n.createdAt, format: .relative(presentation: .named))
                .font(.caption).foregroundStyle(.tertiary)
            }
          }
        }
        .buttonStyle(.plain)
      }
    }
    .overlay {
      if notifications.isEmpty {
        EmptyStateView(symbol: "bell", title: "No notifications",
          message: "Payment reminders will show up here.")
      }
    }
    .navigationTitle("Notifications")
    .toolbar {
      Menu {
        Button("Mark all read") {
          try? Store(context: context).markAllNotificationsRead()
          Task { await sync.syncNow() }
        }
        Button("Clear read", role: .destructive) {
          try? Store(context: context).clearReadNotifications()
          Task { await sync.syncNow() }
        }
      } label: {
        Image(systemName: "ellipsis.circle")
      }
    }
  }
}
