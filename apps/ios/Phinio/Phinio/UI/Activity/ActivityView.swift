import SwiftUI

/// Online-only: the activity log is server-derived and not in the snapshot.
struct ActivityView: View {
  @State private var items: [ActivityItemDTO] = []
  @State private var nextCursor: String?
  @State private var loading = false
  @State private var offline = false
  private let client = APIClient()

  var body: some View {
    List {
      if offline && items.isEmpty {
        ContentUnavailableView(
          "Offline", systemImage: "wifi.slash",
          description: Text("Activity needs a connection."))
          .listRowBackground(Color.clear)
      } else if loading && items.isEmpty {
        skeleton
      } else if items.isEmpty {
        ContentUnavailableView(
          "No activity", systemImage: "clock.arrow.circlepath",
          description: Text("Changes you make will show up here."))
          .listRowBackground(Color.clear)
      } else {
        Section {
          ForEach(items) { row($0) }
          if nextCursor != nil {
            loadMoreRow
          }
        }
      }
    }
    .navigationTitle("Activity")
    .navigationBarTitleDisplayMode(.inline)
    .task { await reload() }
    .refreshable { await reload() }
  }

  /// Placeholder shimmer on first load rather than a bare full-screen spinner.
  private var skeleton: some View {
    Section {
      ForEach(0..<5, id: \.self) { _ in
        HStack(spacing: 12) {
          IconTile(size: 38, radius: 11) { Color.clear }
          VStack(alignment: .leading, spacing: 6) {
            Text("Placeholder summary text")
              .font(.body)
            Text("Entity · moments ago")
              .font(.caption).foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
    .redacted(reason: .placeholder)
    .accessibilityHidden(true)
  }

  private var loadMoreRow: some View {
    Button {
      Task { await loadMore() }
    } label: {
      Group {
        if loading {
          ProgressView().controlSize(.small)
        } else {
          Text("Load more")
        }
      }
      .frame(maxWidth: .infinity)
    }
    .disabled(loading)
  }

  private func row(_ item: ActivityItemDTO) -> some View {
    HStack(alignment: .top, spacing: 12) {
      IconTile(size: 38, radius: 11, background: tint(item.action).opacity(0.12)) {
        Image(systemName: symbol(item.action))
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(tint(item.action))
      }
      VStack(alignment: .leading, spacing: 3) {
        Text(item.summary)
          .font(.body)
          .fixedSize(horizontal: false, vertical: true)
        HStack(spacing: 6) {
          Text(item.entityLabel).font(.caption).foregroundStyle(.secondary)
          if let date = WireDate.timestamp(item.createdAt) {
            Text("·").font(.caption).foregroundStyle(.secondary)
            Text(date, format: .relative(presentation: .named))
              .font(.caption).foregroundStyle(.secondary)
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
    .accessibilityElement(children: .combine)
    .onAppear {
      if item.id == items.last?.id, nextCursor != nil {
        Task { await loadMore() }
      }
    }
  }

  private func diffLine(_ change: ActivityChangeDTO) -> some View {
    HStack(spacing: 4) {
      Text(change.field).foregroundStyle(.secondary)
      Text(format(change.from, change.currency)).foregroundStyle(.tertiary)
      Image(systemName: "arrow.right").font(.system(size: 8))
        .foregroundStyle(.tertiary)
      Text(format(change.to, change.currency)).foregroundStyle(.secondary)
    }
    .font(.caption)
  }

  private func format(_ value: String?, _ currency: String?) -> String {
    guard let value, !value.isEmpty else { return "—" }
    guard let currency, let amount = Money.decimal(value) else { return value }
    return amount.currency(currency)
  }

  private func tint(_ action: String) -> Color {
    switch action {
    case "create": .green
    case "delete": .red
    default: .accentColor
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
