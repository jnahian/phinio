import Charts
import SwiftData
import SwiftUI

struct DashboardView: View {
  @Binding var showNotifications: Bool
  /// Empty-state CTAs open the shell's create sheets.
  var onCreate: (CreateSheet) -> Void = { _ in }

  @EnvironmentObject private var sync: SyncEngine
  @EnvironmentObject private var avatars: AvatarStore
  @Query private var profiles: [Profile]
  @Query private var investments: [Investment]
  @Query private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]
  @Query(filter: #Predicate<AppNotification> { $0.readAt == nil })
  private var unread: [AppNotification]

  /// Legend selection: nil = no focus. Tapping a row focuses its slice and dims
  /// the rest; dimmed rows stay tappable so focus can move directly; tapping the
  /// focused row again clears it.
  @State private var focusedType: String?

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var activeInvestmentCount: Int { investments.count { $0.status == "active" } }
  private var activeEmiCount: Int { emis.count { $0.status == "active" } }

  private var initials: String {
    let parts = (profiles.first?.fullName ?? "").split(separator: " ").prefix(2)
    return parts.compactMap { $0.first }.map(String.init).joined().uppercased()
  }

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
    List {
      if isEmptyPortfolio(stats) {
        emptySections
      } else {
        heroSection(stats)
        quickStats(stats)
        upcomingSection(stats)
        allocationSection(stats)
      }
    }
    .navigationTitle("Home")
    .toolbar {
      if sync.state == .syncing {
        ToolbarItem(placement: .topBarLeading) {
          ProgressView().controlSize(.small)
        }
      }
      ToolbarItem(placement: .topBarTrailing) { bell }
      ToolbarItem(placement: .topBarTrailing) {
        NavigationLink(value: ProfileRoute()) {
          AvatarView(
            initials: initials, size: 30,
            colorKey: profiles.first?.id ?? "", photo: avatars.image)
        }
        .accessibilityLabel("Profile")
      }
    }
    .safeAreaInset(edge: .top) {
      if sync.state == .offline { OfflineBanner() }
    }
    .task { await avatars.refresh() }
    .refreshable { await sync.syncNow() }
  }

  private var bell: some View {
    Button { showNotifications = true } label: {
      Image(systemName: "bell")
        // Rings when the unread count climbs — the badge alone is easy to miss
        // on a screen the user is already scrolling.
        .symbolEffect(.bounce, value: unread.count)
        .overlay(alignment: .topTrailing) {
          if !unread.isEmpty {
            Text("\(unread.count)")
              .font(.caption2.weight(.bold))
              .foregroundStyle(.white)
              .padding(.horizontal, 4)
              .frame(minWidth: 15, minHeight: 15)
              .background(.red, in: .capsule)
              .offset(x: 9, y: -8)
              .transition(.scale.combined(with: .opacity))
          }
        }
        .animation(.snappy, value: unread.count)
    }
    .accessibilityLabel("Notifications")
  }

  // MARK: - Net worth

  private func heroSection(_ stats: DashboardStats) -> some View {
    Section {
      HeroCard(
        gradient: Gradients.netWorthHero, orbTint: .white.opacity(0.14),
        orbSize: 220, orbTopOffset: -90, bottomPadding: 24
      ) {
        VStack(alignment: .leading, spacing: 0) {
          Text("Net Worth")
            .font(.caption.weight(.semibold))
            .textCase(.uppercase)
            .foregroundStyle(.white.opacity(0.72))
          MoneyText(amount: stats.netWorth)
            .font(.largeTitle.weight(.heavy).monospacedDigit())
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.top, 8)
          HStack(spacing: 8) {
            MoneyPill(percent: Decimal(stats.gainLossPercent), size: .hero)
            Text(portfolioSummary)
              .font(.footnote)
              .foregroundStyle(.white.opacity(0.72))
          }
          .padding(.top, 14)
        }
      }
    }
    .listRowInsets(EdgeInsets())
    .listRowBackground(Color.clear)
  }

  private var portfolioSummary: LocalizedStringKey {
    // `inflect:` does not pluralise the acronym "EMI"; spell both out.
    activeEmiCount == 1
      ? "^[\(activeInvestmentCount) investment](inflect: true) · 1 EMI"
      : "^[\(activeInvestmentCount) investment](inflect: true) · \(activeEmiCount) EMIs"
  }

  // MARK: - Quick stats

  private func quickStats(_ stats: DashboardStats) -> some View {
    Section {
      HStack(spacing: 12) {
        statCard("Current value") {
          MoneyText(amount: stats.current)
            .font(.title3.weight(.bold).monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        } caption: {
          MoneyPill(percent: Decimal(stats.gainLossPercent))
        }
        statCard("Monthly EMI") {
          MoneyText(amount: stats.monthlyEmiOutflow)
            .font(.title3.weight(.bold).monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.6)
        } caption: {
          Text(emiCaption).font(.caption).foregroundStyle(.secondary)
        }
      }
    }
    .listRowInsets(EdgeInsets())
    .listRowBackground(Color.clear)
  }

  private func statCard<Value: View, Caption: View>(
    _ label: LocalizedStringKey,
    @ViewBuilder value: () -> Value,
    @ViewBuilder caption: () -> Caption
  ) -> some View {
    VStack(alignment: .leading, spacing: 7) {
      Text(label).font(.footnote).foregroundStyle(.secondary)
      value()
      caption()
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 20, style: .continuous))
  }

  private var emiCaption: LocalizedStringKey {
    activeEmiCount > 0 ? "across ^[\(activeEmiCount) loan](inflect: true)" : "No EMIs yet"
  }

  // MARK: - Upcoming payments

  private func upcomingSection(_ stats: DashboardStats) -> some View {
    Section {
      if stats.upcoming.isEmpty {
        Text("No payments fall in the next 30 days.")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      } else {
        ForEach(stats.upcoming) { item in
          upcomingLink(item)
        }
      }
    } header: {
      HStack {
        Text("Upcoming payments")
        Spacer()
        Text("Next 30 days")
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
    case .deposit:
      NavigationLink(value: InvestmentRoute(id: item.parentId)) { UpcomingRow(item: item) }
    }
  }

  // MARK: - Allocation

  @ViewBuilder
  private func allocationSection(_ stats: DashboardStats) -> some View {
    if !stats.allocation.isEmpty {
      Section("Investment allocation") {
        HStack(spacing: 20) {
          allocationDonut(stats)
          VStack(spacing: 0) {
            ForEach(stats.allocation.prefix(5), id: \.type) { slice in
              legendRow(slice)
            }
          }
        }
        .padding(.vertical, 8)
      }
    }
  }

  private static let donutSize: CGFloat = 120
  private static let donutInnerRatio: CGFloat = 0.733

  /// The hole's diameter, less a 6pt inset. The center label has to be capped
  /// to this: an uncapped overlay lays out at the chart's full width, so
  /// `minimumScaleFactor` never kicks in and long totals spill onto the ring.
  private static var donutLabelWidth: CGFloat {
    donutSize * donutInnerRatio - 12
  }

  private func allocationDonut(_ stats: DashboardStats) -> some View {
    Chart(stats.allocation, id: \.type) { slice in
      SectorMark(
        angle: .value("Value", Double(truncating: NSDecimalNumber(decimal: slice.value))),
        innerRadius: .ratio(Self.donutInnerRatio),
        angularInset: 0
      )
      .foregroundStyle(TypePalette.foreground(for: slice.type))
      .opacity(focusedType == nil || focusedType == slice.type ? 1 : 0.25)
    }
    .chartLegend(.hidden)
    .frame(width: Self.donutSize, height: Self.donutSize)
    .overlay {
      VStack(spacing: 0) {
        Text(focusedValue(stats).currencyCompact(currency))
          .font(.headline.monospacedDigit())
          .lineLimit(1)
          .minimumScaleFactor(0.5)
        Text(focusedType.map(investmentTypeLabel) ?? "total")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
      .frame(width: Self.donutLabelWidth)
      .contentTransition(.numericText())
    }
    .animation(.snappy, value: focusedType)
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
          .font(.subheadline)
          .frame(maxWidth: .infinity, alignment: .leading)
        Text(slice.percent.formatted(.number.precision(.fractionLength(0))) + "%")
          .font(.caption.weight(.semibold).monospacedDigit())
          .foregroundStyle(.secondary)
      }
      .frame(height: 20)
      .padding(.vertical, 4.5)
      .contentShape(.rect)
      // Dimmed rows stay tappable so focus can move straight between types.
      .opacity(focusedType == nil || focused ? 1 : 0.45)
    }
    // `.borderless`, not `.plain`: a List row that holds several buttons routes
    // every tap to the row itself under `.plain`, so all five legend rows shared
    // one hit target and focusing an individual type did nothing.
    .buttonStyle(.borderless)
    .accessibilityLabel(
      "\(investmentTypeLabel(slice.type)), \(slice.percent.formatted(.number.precision(.fractionLength(0)))) percent"
    )
    .accessibilityAddTraits(focused ? [.isButton, .isSelected] : .isButton)
  }

  // MARK: - Empty state

  @ViewBuilder
  private var emptySections: some View {
    Section {
      ContentUnavailableView(
        "Welcome to Phinio", systemImage: "chart.pie",
        description: Text("Add your first investment or EMI to see your dashboard."))
        .listRowBackground(Color.clear)
    }
    Section {
      ctaRow(
        title: "Add your first investment",
        message: "Track stocks, gold, DPS schemes and savings pots.",
        symbol: "chart.line.uptrend.xyaxis", sheet: .investment)
      ctaRow(
        title: "Add your first EMI",
        message: "Generate a full amortization schedule up front.",
        symbol: "creditcard", sheet: .emi)
    }
  }

  private func ctaRow(
    title: LocalizedStringKey, message: LocalizedStringKey, symbol: String, sheet: CreateSheet
  ) -> some View {
    Button { onCreate(sheet) } label: {
      HStack(spacing: 12) {
        IconTile(size: 38, radius: 11) {
          Image(systemName: symbol).font(.system(size: 18)).foregroundStyle(.tint)
        }
        VStack(alignment: .leading, spacing: 2) {
          Text(title).font(.body).foregroundStyle(.primary)
          Text(message).font(.caption).foregroundStyle(.secondary)
        }
      }
    }
  }
}
