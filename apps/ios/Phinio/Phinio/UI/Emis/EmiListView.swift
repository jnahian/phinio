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
    List {
      Section {
        Picker("Status", selection: $statusIndex) {
          Text("Active").tag(0)
          Text("Completed").tag(1)
        }
        .pickerStyle(.segmented)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .onChange(of: statusIndex) { _, _ in typeIndex = 0 }
      }

      Section { summaryRow }

      if filtered.isEmpty {
        Section {
          ContentUnavailableView(
            showCompleted ? "Nothing completed yet" : "No EMIs yet",
            systemImage: "creditcard",
            description: Text(
              showCompleted
                ? "Finished loans and cards will appear here."
                : "Add a loan or credit card to track its schedule."))
            .listRowBackground(Color.clear)
        }
      } else {
        Section {
          ForEach(filtered) { emi in
            NavigationLink(value: EmiRoute(id: emi.id)) {
              EmiRow(
                emi: emi,
                schedule: payments.filter { $0.emiId == emi.id && $0.paymentNumber > 0 },
                remaining: remaining(of: emi),
                currency: currency)
            }
          }
        }
      }
    }
    .navigationTitle("EMIs")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Picker("Type", selection: $typeIndex) {
            Text("All").tag(0)
            Text("Bank Loan").tag(1)
            Text("Credit Card").tag(2)
          }
        } label: {
          Label(
            "Filter by type",
            systemImage: typeIndex == 0
              ? "line.3.horizontal.decrease.circle"
              : "line.3.horizontal.decrease.circle.fill")
        }
      }
    }
  }

  private var summaryRow: some View {
    HStack(spacing: 0) {
      summaryColumn("Active", "\(activeEmis.count)", .primary)
      Divider()
      summaryColumn("Monthly", monthlyOutflow.currencyCompact(currency), .primary)
      Divider()
      // Remaining balance is a liability — tinted red.
      summaryColumn("Remaining", totalRemaining.currencyCompact(currency), .red)
    }
    .padding(.vertical, 6)
  }

  private func summaryColumn(
    _ label: LocalizedStringKey, _ value: String, _ tint: Color
  ) -> some View {
    VStack(spacing: 5) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value)
        .font(.headline.monospacedDigit())
        .foregroundStyle(tint)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .combine)
  }
}

private struct EmiRow: View {
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
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 12) {
        IconTile(size: 42, radius: 12) {
          Image(systemName: isLoan ? "house" : "creditcard")
            .font(.system(size: 20))
            .foregroundStyle(isLoan ? Color.accentColor : TypePalette.crypto)
        }
        VStack(alignment: .leading, spacing: 2) {
          Text(emi.label).font(.headline).lineLimit(1)
          Text(isLoan ? "Bank Loan" : "Credit Card")
            .font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        VStack(alignment: .trailing, spacing: 2) {
          Text(emi.emiAmount.currency(currency))
            .font(.headline.monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.6)
          Text("per month").font(.caption).foregroundStyle(.secondary)
        }
      }

      ProgressView(value: total > 0 ? Double(paidCount) / Double(total) : 0) {
        HStack {
          Text("Remaining \(remaining.currency(currency))")
            .font(.caption).foregroundStyle(.secondary)
          Spacer()
          Text("\(paidCount) / \(total) months")
            .font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
        }
      }
      .padding(.top, 12)

      if let nextDue {
        (Text("Next due ") + Text(nextDue, format: .dateTime.day().month(.abbreviated).year()))
          .font(.caption)
          .foregroundStyle(.secondary)
          .padding(.top, 8)
      }
    }
    .padding(.vertical, 4)
  }
}
