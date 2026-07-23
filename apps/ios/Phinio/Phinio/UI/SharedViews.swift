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

  private var dueText: String {
    (item.sequenceNumber.map { "#\($0) · " } ?? "") + dueLabel(daysUntil: item.daysUntilDue)
  }

  var body: some View {
    HStack(spacing: 12) {
      IconTile(size: 38, radius: 11) {
        Image(systemName: item.kind == .emi ? "creditcard" : "calendar")
          .font(.system(size: 18))
          .foregroundStyle(.tint)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(item.label)
          .font(.body)
          .lineLimit(1)
        Text(dueText)
          .font(.footnote)
          .foregroundStyle(item.isOverdue ? Color.red : Color.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      MoneyText(amount: item.amount)
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .lineLimit(1)
    }
  }
}
