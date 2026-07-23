import SwiftData
import SwiftUI

/// Presented as a sheet from the Home bell (Phase 2).
struct NotificationsView: View {
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @EnvironmentObject private var deepLink: DeepLinkRouter
  @Query private var all: [AppNotification]

  /// Unread first, then newest — the sort SwiftData can't express in one
  /// descriptor, so it happens here (brief §5.19).
  private var notifications: [AppNotification] {
    all.sorted {
      ($0.readAt == nil ? 0 : 1, $1.createdAt) < ($1.readAt == nil ? 0 : 1, $0.createdAt)
    }
  }

  private var hasUnread: Bool { all.contains { $0.readAt == nil } }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        header

        if notifications.isEmpty {
          NoirEmptyState(
            title: "No notifications",
            message: "Payment reminders will show up here.")
        } else {
          SectionGroup {
            VStack(spacing: 0) {
              ForEach(notifications) { row($0) }
            }
            .padding(.vertical, 6)
          }
          .padding(.horizontal, Layout.screenHorizontalPadding)
        }
      }
      .padding(.bottom, 40)
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .presentationBackground(Color.surface)
    .toolbar(.hidden, for: .navigationBar)
  }

  private var header: some View {
    HStack {
      Text("Notifications")
        .font(.detailTitle).foregroundStyle(Color.onSurface)
      Spacer()
      if hasUnread {
        Button("Mark all read") {
          try? Store(context: context).markAllNotificationsRead()
          Task { await sync.syncNow() }
        }
        .font(.rowLabel(13))
        .foregroundStyle(Color.brandPrimary)
        .frame(minHeight: 44)
      }
    }
    .padding(.horizontal, Layout.screenHorizontalPadding)
    .padding(.top, 20)
    .padding(.bottom, 16)
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
          .fill(unread ? Color.brandPrimary : .clear)
          .frame(width: 8, height: 8)
          .padding(.top, 6)
        VStack(alignment: .leading, spacing: 3) {
          Text(n.title)
            .font(.rowLabel(14))
            .foregroundStyle(unread ? Color.onSurface : Color.onSurfaceVariant)
          Text(n.body)
            .font(.caption).foregroundStyle(Color.onSurfaceVariant)
            .fixedSize(horizontal: false, vertical: true)
          Text(n.createdAt, format: .relative(presentation: .named))
            .font(.meta).foregroundStyle(Color.onSurfaceMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 14)
      .frame(minHeight: 44)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
    .accessibilityValue(unread ? "Unread" : "Read")
  }
}
