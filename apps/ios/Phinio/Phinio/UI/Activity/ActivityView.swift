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
      ForEach(items) { item in
        VStack(alignment: .leading, spacing: 2) {
          Text(item.summary)
          HStack {
            Text(item.entityLabel).font(.caption).foregroundStyle(.secondary)
            Spacer()
            if let date = WireDate.timestamp(item.createdAt) {
              Text(date, format: .relative(presentation: .named))
                .font(.caption).foregroundStyle(.tertiary)
            }
          }
        }
        .onAppear {
          if item.id == items.last?.id, nextCursor != nil {
            Task { await loadMore() }
          }
        }
      }
      if loading { ProgressView().frame(maxWidth: .infinity) }
    }
    .overlay {
      if offline && items.isEmpty {
        EmptyStateView(symbol: "wifi.slash", title: "Offline",
          message: "Activity needs a connection.")
      } else if !loading && !offline && items.isEmpty {
        EmptyStateView(symbol: "clock.arrow.circlepath", title: "No activity",
          message: "Changes you make will show up here.")
      }
    }
    // Notifications are reached from the shell's Home bell now, not from here.
    .navigationTitle("Activity")
    .task { await reload() }
    .refreshable { await reload() }
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
      nextCursor = nil // stop paginating; pull-to-refresh recovers
    }
  }
}
