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

  /// Pills are derived from the types actually present, so no pill ever filters
  /// to an empty list. "All" is always first.
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
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        header
        summaryCard.padding(.top, 4)
        SegmentedTabs(titles: ["Active", "Completed"], selection: $statusIndex)
          .padding(.top, 16)
          .onChange(of: statusIndex) { _, _ in typeIndex = 0 }
        FilterPills(titles: pillTitles, selection: $typeIndex)
          .padding(.top, 14)

        if filtered.isEmpty {
          NoirEmptyState(
            title: "Nothing here yet",
            message: showCompleted
              ? "No completed investments match this filter."
              : "No investments match this filter.")
        } else {
          VStack(spacing: Layout.cardGap) {
            ForEach(filtered) { inv in
              NavigationLink(value: InvestmentRoute(id: inv.id)) {
                InvestmentCard(
                  investment: inv, deposits: deposits(for: inv), currency: currency)
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

  private func deposits(for inv: Investment) -> [InvestmentDeposit] {
    deposits.filter { $0.investmentId == inv.id }
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 0) {
      Text("Investments")
        .font(.screenTitle)
        .tracking(Tracking.screenTitle)
        .foregroundStyle(Color.onSurface)
      Text(countLabel)
        .font(.body)
        .foregroundStyle(Color.onSurfaceVariant)
    }
    .padding(.top, 4)
  }

  private var countLabel: LocalizedStringKey {
    let active = investments.count { $0.status == "active" }
    let done = investments.count - active
    return "\(active) active · \(done) completed"
  }

  private var summaryCard: some View {
    HStack(spacing: 0) {
      // Comp rounds the summary row (its fmt() drops cents); full precision here
      // just forces every column to shrink to fit.
      summaryColumn("Invested", totalInvested.currencyCompact(currency), Color.onSurface)
      // Comp separates the three columns with hairlines, not full dividers.
      hairline
      summaryColumn("Value", totalCurrent.currencyCompact(currency), Color.onSurface)
      hairline
      summaryColumn(
        "Return",
        returnPercent.map { $0.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1))) + "%" } ?? "—",
        (returnPercent ?? 0) >= 0 ? Color.brandSecondary : Color.tertiaryFixedDim)
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

/// One card per investment, switched on `mode`. Lump-sum, DPS and savings each
/// surface different figures (comp INVEST block).
private struct InvestmentCard: View {
  let investment: Investment
  let deposits: [InvestmentDeposit]
  let currency: String

  private var paidCount: Int { deposits.count { $0.status == "paid" } }

  var body: some View {
    NoirCard {
      VStack(alignment: .leading, spacing: 0) {
        HStack(spacing: 10) {
          Text(investment.name)
            .font(.cardTitle)
            .foregroundStyle(Color.onSurface)
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
    }
  }

  // MARK: Lump sum

  private var lumpBody: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .bottom) {
        figure("Invested", investment.investedAmount.currency(currency),
               font: .amountSecondary, tint: Color.onSurfaceVariant)
        Spacer()
        figure(
          investment.status == "active" ? "Current value" : "Exit value",
          (investment.exitValue ?? investment.currentValue).currency(currency),
          font: .amountLarge(20), tint: Color.onSurface, alignment: .trailing)
      }
      .padding(.top, 14)

      HStack {
        if let date = investment.dateOfInvestment {
          Text(date, format: .dateTime.day().month(.abbreviated).year())
            .font(.meta).foregroundStyle(Color.onSurfaceMuted)
        }
        Spacer()
        if let pct = returnPercent { MoneyPill(percent: pct) }
      }
      .padding(.top, 12)
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
        figure("Deposited", investment.investedAmount.currency(currency),
               font: .amountLarge(20), tint: Color.onSurface)
        Spacer()
        figure("Maturity", maturityLabel,
               font: .amountSecondary, tint: Color.brandSecondary, alignment: .trailing)
      }
      .padding(.top, 14)

      Text("\(paidCount) / \(investment.tenureMonths ?? deposits.count) months")
        .font(.custom("Manrope-SemiBold", size: 11))
        .foregroundStyle(Color.onSurfaceVariant)
        .padding(.top, 14)

      NoirProgressBar(fraction: progress, tint: .brandSecondary)
        .padding(.top, 7)

      HStack {
        if let monthly = investment.monthlyDeposit {
          Text(monthly.currency(currency) + "/mo")
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
      .font(.meta)
      .foregroundStyle(Color.onSurfaceMuted)
      .padding(.top, 12)
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
      VStack(alignment: .leading, spacing: 6) {
        Text("^[\(deposits.count) deposit](inflect: true)")
          .font(.meta).foregroundStyle(Color.onSurfaceVariant)
        Text("Deposited \(investment.investedAmount.currency(currency))")
          .font(.meta).foregroundStyle(Color.onSurfaceMuted)
      }
      Spacer()
      figure("Balance", investment.currentValue.currency(currency),
             font: .amountLarge(20), tint: Color.onSurface, alignment: .trailing)
    }
    .padding(.top, 14)
  }

  // MARK: Shared

  private func figure(
    _ label: String, _ value: String, font: Font, tint: Color,
    alignment: HorizontalAlignment = .leading
  ) -> some View {
    VStack(alignment: alignment, spacing: 3) {
      Text(label).font(.meta).foregroundStyle(Color.onSurfaceVariant)
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
