import SwiftData
import SwiftUI

struct EmiListView: View {
  @Query(sort: \Emi.updatedAt, order: .reverse) private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var profiles: [Profile]

  @State private var statusIndex = 0  // 0 = Active, 1 = Completed
  @State private var typeIndex = 0  // 0 = All

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var showCompleted: Bool { statusIndex == 1 }

  private static let pillTypes = ["bank_loan", "credit_card"]
  private var pillTitles: [String] { ["All", "Bank Loan", "Credit Card"] }

  private var byStatus: [Emi] {
    emis.filter { showCompleted ? $0.status == "completed" : $0.status == "active" }
  }

  private var filtered: [Emi] {
    guard typeIndex > 0 else { return byStatus }
    return byStatus.filter { $0.type == Self.pillTypes[typeIndex - 1] }
  }

  private var activeEmis: [Emi] { emis.filter { $0.status == "active" } }
  private var monthlyOutflow: Decimal { activeEmis.reduce(0) { $0 + $1.emiAmount } }
  private var totalRemaining: Decimal {
    activeEmis.reduce(0) { $0 + remaining(of: $1) }
  }

  /// Same basis as DashboardStats: the next unpaid payment's stored
  /// remainingBalance, not a sum of emiAmounts (those include interest and
  /// overstate the liability). `paymentNumber == 0` is the processing-fee
  /// sentinel and never counts as a scheduled payment.
  private func remaining(of emi: Emi) -> Decimal {
    let next = payments
      .filter { $0.emiId == emi.id && $0.paymentNumber > 0 && $0.status != "paid" }
      .min { $0.paymentNumber < $1.paymentNumber }
    return next?.remainingBalance ?? 0
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        Text("EMIs")
          .font(.screenTitle)
          .tracking(Tracking.screenTitle)
          .foregroundStyle(Color.onSurface)
          .padding(.vertical, 4)

        summaryCard.padding(.top, 12)

        SegmentedTabs(titles: ["Active", "Completed"], selection: $statusIndex)
          .padding(.top, 16)
          .onChange(of: statusIndex) { _, _ in typeIndex = 0 }
        FilterPills(titles: pillTitles, selection: $typeIndex)
          .padding(.top, 14)

        if filtered.isEmpty {
          NoirEmptyState(
            title: showCompleted ? "Nothing completed yet" : "No EMIs yet",
            message: showCompleted
              ? "Finished loans and cards will appear here."
              : "Add a loan or credit card to track its schedule.")
        } else {
          VStack(spacing: Layout.cardGap) {
            ForEach(filtered) { emi in
              NavigationLink(value: EmiRoute(id: emi.id)) {
                EmiCard(
                  emi: emi,
                  schedule: payments.filter { $0.emiId == emi.id && $0.paymentNumber > 0 },
                  remaining: remaining(of: emi),
                  currency: currency)
              }
              .buttonStyle(.plain)
            }
          }
          .padding(.top, 14)
        }
      }
      .padding(.horizontal, Layout.screenHorizontalPadding)
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .toolbar(.hidden, for: .navigationBar)
  }

  private var summaryCard: some View {
    HStack(spacing: 0) {
      summaryColumn("Active", "\(activeEmis.count)", Color.onSurface)
      hairline
      summaryColumn("Monthly", monthlyOutflow.currencyCompact(currency), Color.onSurface)
      hairline
      // Remaining balance is a liability — comp tints it, but with
      // tertiaryFixedDim rather than the full loss red (brief §6).
      summaryColumn("Remaining", totalRemaining.currencyCompact(currency), Color.tertiaryFixedDim)
    }
    .padding(.vertical, 18)
    .padding(.horizontal, 8)
    .background(
      Gradients.summaryCard,
      in: RoundedRectangle(cornerRadius: Radii.summary, style: .continuous))
  }

  private var hairline: some View {
    Rectangle()
      .fill(Color.outlineVariant.opacity(0.6))
      .frame(width: 0.5)
      .frame(maxHeight: .infinity)
  }

  private func summaryColumn(_ label: String, _ value: String, _ tint: Color) -> some View {
    VStack(spacing: 6) {
      Text(label).font(.meta).foregroundStyle(Color.onSurfaceVariant)
      Text(value)
        .font(.custom("Manrope-Bold", size: 17))
        .foregroundStyle(tint)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity)
    .padding(.horizontal, 4)
    .accessibilityElement(children: .combine)
  }
}

private struct EmiCard: View {
  let emi: Emi
  let schedule: [EmiPayment]
  let remaining: Decimal
  let currency: String

  private var isLoan: Bool { emi.type == "bank_loan" }
  private var paidCount: Int { schedule.count { $0.status == "paid" } }
  private var total: Int { max(schedule.count, emi.tenureMonths) }
  private var nextDue: Date? {
    schedule.filter { $0.status != "paid" }.map(\.dueDate).min()
  }

  var body: some View {
    NoirCard {
      VStack(alignment: .leading, spacing: 0) {
        HStack(spacing: 12) {
          IconTile(size: 42, radius: Radii.segmentTrack, background: .surfaceHighest) {
            Image(systemName: isLoan ? "house" : "creditcard")
              .font(.system(size: 20))
              .foregroundStyle(isLoan ? Color.brandPrimary : TypePalette.crypto)
          }
          VStack(alignment: .leading, spacing: 2) {
            Text(emi.label).font(.cardTitle).foregroundStyle(Color.onSurface).lineLimit(1)
            Text(isLoan ? "Bank Loan" : "Credit Card")
              .font(.caption).foregroundStyle(Color.onSurfaceVariant)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          VStack(alignment: .trailing, spacing: 2) {
            Text(emi.emiAmount.currency(currency))
              .font(.custom("Manrope-Bold", size: 17))
              .foregroundStyle(Color.onSurface)
              .lineLimit(1)
              .minimumScaleFactor(0.6)
            Text("per month").font(.meta).foregroundStyle(Color.onSurfaceMuted)
          }
        }

        HStack {
          Text("Remaining \(remaining.currency(currency))")
            .font(.meta).foregroundStyle(Color.onSurfaceVariant)
          Spacer()
          Text("\(paidCount) / \(total) months")
            .font(.custom("Manrope-SemiBold", size: 11))
            .foregroundStyle(Color.onSurfaceVariant)
        }
        .padding(.top, 16)

        NoirProgressBar(
          fraction: total > 0 ? Double(paidCount) / Double(total) : 0,
          tint: .primaryContainer
        )
        .padding(.top, 8)

        if let nextDue {
          (Text("Next due ") + Text(nextDue, format: .dateTime.day().month(.abbreviated).year()))
            .font(.meta)
            .foregroundStyle(Color.onSurfaceMuted)
            .padding(.top, 10)
        }
      }
    }
  }
}
