import Charts
import SwiftData
import SwiftUI

struct DashboardView: View {
  /// Empty-state CTAs open the shell's create sheets — the FAB owns creation
  /// since Phase 2, so the tab shell hands the presenter down.
  var onCreate: (CreateSheet) -> Void = { _ in }

  @EnvironmentObject private var sync: SyncEngine
  @Query private var profiles: [Profile]
  @Query private var investments: [Investment]
  @Query private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]

  /// Legend selection: nil = no focus. Tapping a row focuses its slice and dims
  /// the rest; dimmed rows stay tappable so focus can move directly; tapping the
  /// focused row again clears it (brief §5.6).
  @State private var focusedType: String?

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var activeInvestmentCount: Int { investments.count { $0.status == "active" } }
  private var activeEmiCount: Int { emis.count { $0.status == "active" } }

  private func isEmptyPortfolio(_ stats: DashboardStats) -> Bool {
    stats.invested == 0 && stats.monthlyEmiOutflow == 0
      && stats.upcoming.isEmpty && stats.allocation.isEmpty
  }

  var body: some View {
    // Computed once per body pass — the aggregation walks every model array
    // and body reads it from a dozen places.
    let stats = DashboardStats.compute(
      investments: investments, emis: emis, payments: payments,
      deposits: deposits, withdrawals: withdrawals, now: Date())
    ScrollView {
      if isEmptyPortfolio(stats) {
        emptyState
      } else {
        VStack(alignment: .leading, spacing: 0) {
          netWorthHero(stats)
          quickStats(stats)
          upcomingSection(stats)
          allocationSection(stats)
        }
        .padding(.horizontal, Layout.screenHorizontalPadding)
      }
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .refreshable { await sync.syncNow() }
  }

  // MARK: - Net worth

  private func netWorthHero(_ stats: DashboardStats) -> some View {
    // Comp's home hero orb is larger and sits higher than the detail heroes'.
    HeroCard(
      gradient: Gradients.netWorthHero, orbTint: Color.brandPrimary.opacity(0.18),
      orbSize: 220, orbTopOffset: -90, bottomPadding: 24
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Net Worth")
          .font(.heroLabel)
          .tracking(Tracking.heroLabel)
          .textCase(.uppercase)
          .foregroundStyle(Color.onHeroVariant.opacity(0.72))
        MoneyText(amount: stats.netWorth)
          .font(.heroNumeric)
          .tracking(Tracking.heroNumeric)
          .foregroundStyle(Color.onHeroVariant)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
          .padding(.top, 8)
        HStack(spacing: 8) {
          MoneyPill(percent: Decimal(stats.gainLossPercent), size: .hero)
          Text(portfolioSummary)
            .font(.caption)
            .foregroundStyle(Color.onHeroVariant.opacity(0.72))
        }
        .padding(.top, 14)
      }
    }
  }

  private var portfolioSummary: LocalizedStringKey {
    // `inflect:` does not pluralise the acronym "EMI"; spell both out.
    activeEmiCount == 1
      ? "^[\(activeInvestmentCount) investment](inflect: true) · 1 EMI"
      : "^[\(activeInvestmentCount) investment](inflect: true) · \(activeEmiCount) EMIs"
  }

  // MARK: - Quick stats

  private func quickStats(_ stats: DashboardStats) -> some View {
    HStack(spacing: Layout.cardGap) {
      NoirCard {
        VStack(alignment: .leading, spacing: 0) {
          Text("Current value").font(.caption).foregroundStyle(Color.onSurfaceVariant)
          MoneyText(amount: stats.current)
            .font(.amountLarge(22))
            .foregroundStyle(Color.onSurface)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.top, 7)
          MoneyPill(percent: Decimal(stats.gainLossPercent)).padding(.top, 9)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      NoirCard {
        VStack(alignment: .leading, spacing: 0) {
          Text("Monthly EMI").font(.caption).foregroundStyle(Color.onSurfaceVariant)
          MoneyText(amount: stats.monthlyEmiOutflow)
            .font(.amountLarge(22))
            .foregroundStyle(Color.onSurface)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.top, 7)
          Text(emiCaption)
            .font(.meta)
            .foregroundStyle(Color.onSurfaceVariant)
            .padding(.top, 9)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .padding(.top, 14)
  }

  private var emiCaption: LocalizedStringKey {
    activeEmiCount > 0 ? "across ^[\(activeEmiCount) loan](inflect: true)" : "No EMIs yet"
  }

  // MARK: - Upcoming payments

  private func upcomingSection(_ stats: DashboardStats) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      SectionHeader(title: "Upcoming Payments", trailing: "Next 30 days")
        .padding(.top, Layout.sectionGap)
      if stats.upcoming.isEmpty {
        NoirEmptyState(
          title: "Nothing due",
          message: "No payments fall in the next 30 days.")
      } else {
        SectionGroup {
          // Comp's group is `padding:6px 16px`; rows carry the 16 horizontal,
          // the 6 vertical belongs to the group.
          VStack(spacing: 0) {
            ForEach(stats.upcoming) { item in
              upcomingLink(item)
            }
          }
          .padding(.vertical, 6)
        }
        .padding(.top, 12)
      }
    }
  }

  // Typed NavigationLinks — a single AnyHashable-boxed value doesn't reliably
  // match the tab's typed navigationDestination(for:), so the tap would no-op.
  @ViewBuilder
  private func upcomingLink(_ item: UpcomingItem) -> some View {
    switch item.kind {
    case .emi:
      NavigationLink(value: EmiRoute(id: item.parentId)) { UpcomingRow(item: item) }
        .buttonStyle(.plain)
    case .deposit:
      NavigationLink(value: InvestmentRoute(id: item.parentId)) { UpcomingRow(item: item) }
        .buttonStyle(.plain)
    }
  }

  // MARK: - Allocation

  @ViewBuilder
  private func allocationSection(_ stats: DashboardStats) -> some View {
    if !stats.allocation.isEmpty {
      VStack(alignment: .leading, spacing: 0) {
        SectionHeader(title: "Investment Allocation")
          .padding(.top, Layout.sectionGap)

        HStack(spacing: 20) {
          allocationDonut(stats)
          VStack(spacing: 0) {
            // Comp legend lists the top 5 types; row padding carries the 9pt gap.
            ForEach(stats.allocation.prefix(5), id: \.type) { slice in
              legendRow(slice)
            }
          }
        }
        .padding(.vertical, 20)
        .padding(.horizontal, 18)
        .background(
          Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous)
        )
        .padding(.top, 12)
      }
    }
  }

  private func allocationDonut(_ stats: DashboardStats) -> some View {
    Chart(stats.allocation, id: \.type) { slice in
      SectorMark(
        angle: .value("Value", Double(truncating: NSDecimalNumber(decimal: slice.value))),
        // Comp insets the hole 16pt inside a 120pt ring: 88/120.
        innerRadius: .ratio(0.733),
        angularInset: 0
      )
      .foregroundStyle(TypePalette.foreground(for: slice.type))
      .opacity(focusedType == nil || focusedType == slice.type ? 1 : 0.25)
    }
    .chartLegend(.hidden)
    .frame(width: 120, height: 120)
    .overlay {
      VStack(spacing: 0) {
        Text(focusedValue(stats).currencyCompact(currency))
          .font(.custom("Manrope-ExtraBold", size: 18))
          .foregroundStyle(Color.onSurface)
          .lineLimit(1)
          .minimumScaleFactor(0.5)
        Text(focusedType.map(investmentTypeLabel) ?? "total")
          .font(.custom("Inter-Medium", size: 10))
          .foregroundStyle(Color.onSurfaceVariant)
          .lineLimit(1)
      }
      .padding(.horizontal, 14)
    }
    .accessibilityHidden(true)  // the legend rows below carry the same data
  }

  private func focusedValue(_ stats: DashboardStats) -> Decimal {
    guard let focusedType else { return stats.current }
    return stats.allocation.first { $0.type == focusedType }?.value ?? stats.current
  }

  private func legendRow(_ slice: (type: String, value: Decimal, percent: Double)) -> some View {
    let focused = focusedType == slice.type
    return Button {
      focusedType = focused ? nil : slice.type
    } label: {
      HStack(spacing: 9) {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(TypePalette.foreground(for: slice.type))
          .frame(width: 9, height: 9)
        Text(investmentTypeLabel(slice.type))
          .font(.body)
          .foregroundStyle(Color.onSurface)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text(slice.percent.formatted(.number.precision(.fractionLength(0))) + "%")
          .font(.pillText(12))
          .foregroundStyle(Color.onSurfaceVariant)
      }
      // Legend rows sit on a ~29pt pitch in the comp (row + 9pt gap). Forcing
      // each to 44pt doubles the card's height and breaks the donut/legend
      // balance, and rows this close cannot be enlarged without overlapping
      // their neighbours — so the hit area is the full pitch, not 44pt. The
      // donut carries the same information for anyone who needs a larger target.
      .frame(height: 20)
      .padding(.vertical, 4.5)
      .contentShape(.rect)
      // Dimmed rows stay tappable so focus can move straight between types.
      .opacity(focusedType == nil || focused ? 1 : 0.45)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(
      "\(investmentTypeLabel(slice.type)), \(slice.percent.formatted(.number.precision(.fractionLength(0)))) percent"
    )
    .accessibilityAddTraits(focused ? [.isButton, .isSelected] : .isButton)
  }

  // MARK: - Empty state

  private var emptyState: some View {
    VStack(spacing: Layout.cardGap) {
      NoirEmptyState(
        title: "Welcome to Phinio",
        message: "Add your first investment or EMI to see your dashboard.")
      ctaCard(
        title: "Add your first investment",
        message: "Track stocks, gold, DPS schemes and savings pots.",
        symbol: "chart.line.uptrend.xyaxis", tint: .brandPrimary, sheet: .investment)
      ctaCard(
        title: "Add your first EMI",
        message: "Generate a full amortization schedule up front.",
        symbol: "creditcard", tint: TypePalette.crypto, sheet: .emi)
    }
    .padding(.horizontal, Layout.screenHorizontalPadding)
  }

  private func ctaCard(
    title: String, message: String, symbol: String, tint: Color, sheet: CreateSheet
  ) -> some View {
    Button { onCreate(sheet) } label: {
      NoirCard {
        HStack(spacing: 12) {
          IconTile(size: 38, radius: Radii.iconTile, background: .surfaceHighest) {
            Image(systemName: symbol).font(.system(size: 18)).foregroundStyle(tint)
          }
          VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.rowLabel(14)).foregroundStyle(Color.onSurface)
            Text(message).font(.meta).foregroundStyle(Color.onSurfaceVariant)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(title)
    .accessibilityHint(message)
  }
}
