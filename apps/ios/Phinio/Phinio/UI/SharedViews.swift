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
      IconTile(size: 38, radius: Radii.iconTile) {
        Image(systemName: item.kind == .emi ? "creditcard" : "calendar")
          .font(.system(size: 18))
          .foregroundStyle(Color.brandPrimary)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(item.label)
          .font(.rowLabel(14))
          .foregroundStyle(Color.onSurface)
          .lineLimit(1)
        Text(dueText)
          .font(.caption)
          // Overdue uses tertiaryFixedDim, not full error red — that is reserved
          // for actual losses and destructive actions (brief §6).
          .foregroundStyle(item.isOverdue ? Color.tertiaryFixedDim : Color.onSurfaceVariant)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      MoneyText(amount: item.amount)
        .font(.amount)
        .foregroundStyle(Color.onSurface)
        .lineLimit(1)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 13)
    .contentShape(.rect)
  }
}
