import SwiftUI

/// Online-only: the activity log is server-derived and not in the snapshot.
struct ActivityView: View {
  @Environment(\.dismiss) private var dismiss
  @State private var items: [ActivityItemDTO] = []
  @State private var nextCursor: String?
  @State private var loading = false
  @State private var offline = false
  private let client = APIClient()

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        DetailHeader(title: "Activity", onBack: { dismiss() })

        if offline && items.isEmpty {
          NoirEmptyState(title: "Offline", message: "Activity needs a connection.")
        } else if loading && items.isEmpty {
          skeleton
        } else if items.isEmpty {
          NoirEmptyState(
            title: "No activity", message: "Changes you make will show up here.")
        } else {
          SectionGroup {
            VStack(spacing: 0) {
              ForEach(items) { row($0) }
            }
            .padding(.vertical, 6)
          }
          .padding(.horizontal, Layout.screenHorizontalPadding)

          if nextCursor != nil {
            Button { Task { await loadMore() } } label: {
              Group {
                if loading {
                  ProgressView().controlSize(.small).tint(Color.brandPrimary)
                } else {
                  Text("Load more").font(.rowLabel(14))
                }
              }
              .foregroundStyle(Color.brandPrimary)
              .frame(maxWidth: .infinity, minHeight: 48)
              .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .disabled(loading)
            .padding(.horizontal, Layout.screenHorizontalPadding)
            .padding(.top, 8)
          }
        }
      }
      .padding(.bottom, 40)
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .toolbar(.hidden, for: .navigationBar)
    .task { await reload() }
    .refreshable { await reload() }
  }

  /// Shimmer on first load rather than a bare full-screen spinner (brief §6).
  private var skeleton: some View {
    SectionGroup {
      VStack(spacing: 0) {
        ForEach(0..<5, id: \.self) { _ in
          HStack(spacing: 12) {
            IconTile(size: 38, radius: Radii.iconTile) { Color.clear }
            VStack(alignment: .leading, spacing: 6) {
              Text("Placeholder summary text")
                .font(.rowLabel(14)).foregroundStyle(Color.onSurface)
              Text("Entity · moments ago")
                .font(.meta).foregroundStyle(Color.onSurfaceMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
          }
          .padding(.horizontal, 16)
          .padding(.vertical, 14)
        }
      }
      .padding(.vertical, 6)
    }
    .redacted(reason: .placeholder)
    .padding(.horizontal, Layout.screenHorizontalPadding)
    .accessibilityHidden(true)
  }

  private func row(_ item: ActivityItemDTO) -> some View {
    HStack(alignment: .top, spacing: 12) {
      IconTile(size: 38, radius: Radii.iconTile, background: tint(item.action).opacity(0.12)) {
        Image(systemName: symbol(item.action))
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(tint(item.action))
      }
      VStack(alignment: .leading, spacing: 3) {
        Text(item.summary)
          .font(.rowLabel(14)).foregroundStyle(Color.onSurface)
          .fixedSize(horizontal: false, vertical: true)
        HStack(spacing: 6) {
          Text(item.entityLabel).font(.meta).foregroundStyle(Color.onSurfaceVariant)
          if let date = WireDate.timestamp(item.createdAt) {
            Text("·").font(.meta).foregroundStyle(Color.onSurfaceMuted)
            Text(date, format: .relative(presentation: .named))
              .font(.meta).foregroundStyle(Color.onSurfaceMuted)
          }
        }
        // Updates carry a field-level diff (old → new).
        if let changes = item.changes, !changes.isEmpty {
          VStack(alignment: .leading, spacing: 2) {
            ForEach(changes.indices, id: \.self) { i in
              diffLine(changes[i])
            }
          }
          .padding(.top, 4)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .accessibilityElement(children: .combine)
    .onAppear {
      if item.id == items.last?.id, nextCursor != nil {
        Task { await loadMore() }
      }
    }
  }

  private func diffLine(_ change: ActivityChangeDTO) -> some View {
    HStack(spacing: 4) {
      Text(change.field).foregroundStyle(Color.onSurfaceMuted)
      Text(format(change.from, change.currency)).foregroundStyle(Color.onSurfaceFaint)
      Image(systemName: "arrow.right").font(.system(size: 8))
        .foregroundStyle(Color.onSurfaceFaint)
      Text(format(change.to, change.currency)).foregroundStyle(Color.onSurfaceVariant)
    }
    .font(.meta)
  }

  private func format(_ value: String?, _ currency: String?) -> String {
    guard let value, !value.isEmpty else { return "—" }
    guard let currency, let amount = Money.decimal(value) else { return value }
    return amount.currency(currency)
  }

  private func tint(_ action: String) -> Color {
    switch action {
    case "create": Color.brandSecondary
    case "delete": Color.error
    default: Color.brandPrimary
    }
  }

  private func symbol(_ action: String) -> String {
    switch action {
    case "create": "plus"
    case "delete": "trash"
    default: "pencil"
    }
  }

  private func reload() async {
    loading = true
    defer { loading = false }
    do {
      let page = try await client.fetchActivity(cursor: nil)
      items = page.items
      nextCursor = page.nextCursor
      offline = false
    } catch {
      offline = true
    }
  }

  private func loadMore() async {
    guard let cursor = nextCursor, !loading else { return }
    loading = true
    defer { loading = false }
    do {
      let page = try await client.fetchActivity(cursor: cursor)
      items += page.items
      nextCursor = page.nextCursor
    } catch {
      nextCursor = nil  // stop paginating; pull-to-refresh recovers
    }
  }
}
