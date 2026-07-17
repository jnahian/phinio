import SwiftData
import SwiftUI

/// Amount rendered in the profile's preferred currency (BDT until synced).
struct MoneyText: View {
  let amount: Decimal
  @Query private var profiles: [Profile]

  var body: some View {
    Text(amount.currency(profiles.first?.preferredCurrency ?? "BDT"))
  }
}

struct EmptyStateView: View {
  let symbol: String
  let title: String
  let message: String

  var body: some View {
    ContentUnavailableView(
      title, systemImage: symbol, description: Text(message))
  }
}

struct UpcomingRow: View {
  let item: UpcomingItem

  var body: some View {
    HStack {
      VStack(alignment: .leading) {
        Text(item.label).font(.body)
        Text(item.sequenceNumber.map { "#\($0) · " } ?? "")
          .font(.caption).foregroundStyle(.secondary)
          + Text(dueLabel(daysUntil: item.daysUntilDue))
          .font(.caption)
          .foregroundStyle(
            item.isOverdue
              ? AnyShapeStyle(.red)
              : AnyShapeStyle(.secondary))
      }
      Spacer()
      MoneyText(amount: item.amount).font(.body.monospacedDigit())
    }
  }
}
