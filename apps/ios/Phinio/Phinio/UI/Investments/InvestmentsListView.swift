import SwiftData
import SwiftUI

struct InvestmentsListView: View {
  @Query(sort: \Investment.updatedAt, order: .reverse)
  private var investments: [Investment]
  @Query private var deposits: [InvestmentDeposit]
  @Query private var profiles: [Profile]

  @State private var statusIndex = 0  // 0 = Active, 1 = Completed
  @State private var typeIndex = 0  // 0 = All

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var showCompleted: Bool { statusIndex == 1 }

  // Web filter: active = ['active']; completed = ['completed','matured','closed']
  private var byStatus: [Investment] {
    investments.filter { showCompleted ? $0.status != "active" : $0.status == "active" }
  }

  /// Filter options are derived from the types actually present, so no option
  /// ever filters to an empty list. "All" is always first.
  private var pillTypes: [String] {
    var seen: [String] = []
    for inv in byStatus where !seen.contains(inv.type) { seen.append(inv.type) }
    return seen.sorted { investmentTypeLabel($0) < investmentTypeLabel($1) }
  }

  private var pillTitles: [String] { ["All"] + pillTypes.map(investmentTypeLabel) }

  private var filtered: [Investment] {
    guard typeIndex > 0, typeIndex <= pillTypes.count else { return byStatus }
    let type = pillTypes[typeIndex - 1]
    return byStatus.filter { $0.type == type }
  }

  // Summary covers all three modes, active only — matches the dashboard's basis.
  private var activeInvestments: [Investment] { investments.filter { $0.status == "active" } }
  private var totalInvested: Decimal { activeInvestments.reduce(0) { $0 + $1.investedAmount } }
  private var totalCurrent: Decimal { activeInvestments.reduce(0) { $0 + $1.currentValue } }
  private var returnPercent: Decimal? {
    guard totalInvested > 0 else { return nil }
    return (totalCurrent - totalInvested) / totalInvested * 100
  }

  var body: some View {
    List {
      // Portfolio totals lead; the Active/Completed switch sits directly above
      // the list it filters, not above the summary (which is always active-only).
      Section { summaryRow }

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

      if filtered.isEmpty {
        Section {
          ContentUnavailableView(
            "Nothing here yet",
            systemImage: "chart.line.uptrend.xyaxis",
            description: Text(
              showCompleted
                ? "No completed investments match this filter."
                : "No investments match this filter."))
            .listRowBackground(Color.clear)
        }
      } else {
        Section {
          ForEach(filtered) { inv in
            NavigationLink(value: InvestmentRoute(id: inv.id)) {
              InvestmentRow(
                investment: inv, deposits: deposits(for: inv), currency: currency)
            }
          }
        }
      }
    }
    .navigationTitle("Investments")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Picker("Type", selection: $typeIndex) {
            ForEach(Array(pillTitles.enumerated()), id: \.offset) { i, title in
              Text(title).tag(i)
            }
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

  private func deposits(for inv: Investment) -> [InvestmentDeposit] {
    deposits.filter { $0.investmentId == inv.id }
  }

  private var summaryRow: some View {
    HStack(spacing: 0) {
      // Compact figures — full precision just forces every column to shrink.
      summaryColumn("Invested", totalInvested.currencyCompact(currency), .primary)
      Divider()
      summaryColumn("Value", totalCurrent.currencyCompact(currency), .primary)
      Divider()
      summaryColumn(
        "Return",
        returnPercent.map {
          $0.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1))) + "%"
        } ?? "—",
        (returnPercent ?? 0) >= 0 ? Color.green : Color.red)
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

/// One row per investment, switched on `mode`. Lump-sum, DPS and savings each
/// surface different figures.
private struct InvestmentRow: View {
  let investment: Investment
  let deposits: [InvestmentDeposit]
  let currency: String

  private var paidCount: Int { deposits.count { $0.status == "paid" } }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 10) {
        Text(investment.name)
          .font(.headline)
          .lineLimit(1)
        Spacer(minLength: 0)
        TypeBadge(type: investment.type)
      }
      switch investment.mode {
      case "scheduled": dpsBody
      case "flexible": savingsBody
      default: lumpBody
      }
    }
    .padding(.vertical, 4)
  }

  // MARK: Lump sum

  private var lumpBody: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .bottom) {
        figure(
          "Invested", investment.investedAmount.currency(currency),
          font: .subheadline.monospacedDigit(), tint: .secondary)
        Spacer()
        figure(
          investment.status == "active" ? "Current value" : "Exit value",
          (investment.exitValue ?? investment.currentValue).currency(currency),
          font: .title3.weight(.bold).monospacedDigit(), tint: .primary,
          alignment: .trailing)
      }
      .padding(.top, 12)

      HStack {
        if let date = investment.dateOfInvestment {
          Text(date, format: .dateTime.day().month(.abbreviated).year())
            .font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        if let pct = returnPercent { MoneyPill(percent: pct) }
      }
      .padding(.top, 10)
    }
  }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    let value = investment.exitValue ?? investment.currentValue
    return (value - investment.investedAmount) / investment.investedAmount * 100
  }

  // MARK: DPS

  private var dpsBody: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .bottom) {
        figure(
          "Deposited", investment.investedAmount.currency(currency),
          font: .title3.weight(.bold).monospacedDigit(), tint: .primary)
        Spacer()
        figure(
          "Maturity", maturityLabel,
          font: .subheadline.monospacedDigit(), tint: .green, alignment: .trailing)
      }
      .padding(.top, 12)

      ProgressView(
        value: progress
      ) {
        Text("\(paidCount) / \(investment.tenureMonths ?? deposits.count) months")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
      }
      .tint(.green)
      .padding(.top, 10)

      HStack {
        if let monthly = investment.monthlyDeposit {
          Text(monthly.currency(currency) + "/mo")
            .monospacedDigit()
        }
        Spacer()
        if let rate = investment.interestRate {
          Text(rate.formatted(.number.precision(.fractionLength(0))) + "% p.a.")
        }
        Spacer()
        if let next = nextDue {
          Text("Next ") + Text(next, format: .dateTime.day().month(.abbreviated))
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
      .padding(.top, 10)
    }
  }

  /// Maturity is the last installment's accrued value — server-computed, since
  /// deriving it on-device would mean re-implementing the schedule. Shows a
  /// placeholder until the first sync populates it.
  private var maturityLabel: String {
    guard let accrued = deposits
      .sorted(by: { ($0.installmentNumber ?? 0) < ($1.installmentNumber ?? 0) })
      .last?.accruedValue
    else { return "—" }
    return accrued.currency(currency)
  }

  private var progress: Double {
    let total = investment.tenureMonths ?? deposits.count
    guard total > 0 else { return 0 }
    return Double(paidCount) / Double(total)
  }

  private var nextDue: Date? {
    deposits.filter { $0.status != "paid" }.compactMap(\.dueDate).min()
  }

  // MARK: Savings

  private var savingsBody: some View {
    HStack(alignment: .bottom) {
      VStack(alignment: .leading, spacing: 5) {
        Text("^[\(deposits.count) deposit](inflect: true)")
          .font(.caption).foregroundStyle(.secondary)
        Text("Deposited \(investment.investedAmount.currency(currency))")
          .font(.caption).monospacedDigit().foregroundStyle(.secondary)
      }
      Spacer()
      figure(
        "Balance", investment.currentValue.currency(currency),
        font: .title3.weight(.bold).monospacedDigit(), tint: .primary,
        alignment: .trailing)
    }
    .padding(.top, 12)
  }

  // MARK: Shared

  private func figure(
    _ label: LocalizedStringKey, _ value: String, font: Font, tint: Color,
    alignment: HorizontalAlignment = .leading
  ) -> some View {
    VStack(alignment: alignment, spacing: 3) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value).font(font).foregroundStyle(tint).lineLimit(1).minimumScaleFactor(0.6)
    }
    .accessibilityElement(children: .combine)
  }
}

/// Detail dispatch by mode. Detail views take an id and re-query so a
/// deep link works and deletion pops gracefully.
struct InvestmentDetailRouter: View {
  let investmentId: String
  @Query private var matches: [Investment]

  init(investmentId: String) {
    self.investmentId = investmentId
    _matches = Query(filter: #Predicate<Investment> { $0.id == investmentId })
  }

  var body: some View {
    if let inv = matches.first {
      switch inv.mode {
      case "flexible": SavingsDetailView(investment: inv)
      case "scheduled": DpsDetailView(investment: inv)
      default: LumpSumDetailView(investment: inv)
      }
    } else {
      EmptyStateView(symbol: "questionmark.circle", title: "Not found",
        message: "This investment is no longer on this device.")
    }
  }
}
