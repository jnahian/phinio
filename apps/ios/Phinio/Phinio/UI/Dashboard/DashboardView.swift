import Charts
import SwiftData
import SwiftUI

struct DashboardView: View {
  @EnvironmentObject private var sync: SyncEngine
  @Query private var investments: [Investment]
  @Query private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]

  private var stats: DashboardStats {
    DashboardStats.compute(
      investments: investments, emis: emis, payments: payments,
      deposits: deposits, withdrawals: withdrawals, now: Date())
  }

  private var isEmptyPortfolio: Bool {
    stats.invested == 0 && stats.monthlyEmiOutflow == 0
      && stats.upcoming.isEmpty && stats.allocation.isEmpty
  }

  var body: some View {
    ScrollView {
      if isEmptyPortfolio {
        EmptyStateView(
          symbol: "chart.pie",
          title: "Welcome to Phinio",
          message: "Add your first investment or EMI to see your dashboard.")
          .padding(.top, 80)
      } else {
        VStack(spacing: 16) {
          statCards
          if !stats.allocation.isEmpty { allocationCard }
          upcomingSection
        }
        .padding()
      }
    }
    .navigationTitle("Dashboard")
    .toolbar {
      ToolbarItem(placement: .topBarLeading) { syncBadge }
      ToolbarItem(placement: .topBarTrailing) {
        NavigationLink { SettingsView() } label: {
          Image(systemName: "gearshape")
        }
      }
    }
    .refreshable { await sync.syncNow() }
  }

  // Custom chrome → Liquid Glass per spec §3.
  private var statCards: some View {
    GlassEffectContainer {
      VStack(spacing: 12) {
        VStack(spacing: 4) {
          Text("Net worth").font(.caption).foregroundStyle(.secondary)
          MoneyText(amount: stats.netWorth)
            .font(.system(.largeTitle, design: .rounded, weight: .bold))
          Text("Assets minus remaining EMI balance")
            .font(.caption2).foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .glassEffect(in: .rect(cornerRadius: 20))

        HStack(spacing: 12) {
          VStack(alignment: .leading, spacing: 4) {
            Text("Invested").font(.caption).foregroundStyle(.secondary)
            MoneyText(amount: stats.current).font(.title3.bold())
            if let gain = stats.gainLossPercent {
              Text(gain, format: .number.sign(strategy: .always())
                     .precision(.fractionLength(2)))
              + Text("%")
            } else {
              Text("No holdings").font(.caption).foregroundStyle(.tertiary)
            }
          }
          .font(.caption)
          .foregroundStyle((stats.gainLossPercent ?? 0) >= 0 ? .green : .red)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding()
          .glassEffect(in: .rect(cornerRadius: 20))

          VStack(alignment: .leading, spacing: 4) {
            Text("Monthly EMI").font(.caption).foregroundStyle(.secondary)
            MoneyText(amount: stats.monthlyEmiOutflow).font(.title3.bold())
            Text(stats.monthlyEmiOutflow > 0 ? "Total outflow" : "No EMIs yet")
              .font(.caption).foregroundStyle(.tertiary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding()
          .glassEffect(in: .rect(cornerRadius: 20))
        }
      }
    }
  }

  private var allocationCard: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Allocation").font(.headline)
      Chart(stats.allocation, id: \.type) { slice in
        SectorMark(
          angle: .value("Value", Double(truncating:
            NSDecimalNumber(decimal: slice.value))),
          innerRadius: .ratio(0.6), angularInset: 1.5)
          .foregroundStyle(by: .value("Type", investmentTypeLabel(slice.type)))
      }
      .frame(height: 200)
      ForEach(stats.allocation, id: \.type) { slice in
        HStack {
          Text(investmentTypeLabel(slice.type)).font(.caption)
          Spacer()
          Text(slice.percent, format: .number.precision(.fractionLength(2)))
            .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
          + Text("%").font(.caption).foregroundStyle(.secondary)
        }
      }
    }
    .padding()
    .background(.fill.tertiary, in: .rect(cornerRadius: 20))
  }

  private var upcomingSection: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Upcoming payments").font(.headline)
      if stats.upcoming.isEmpty {
        Text("Nothing due in the next 30 days")
          .font(.subheadline).foregroundStyle(.secondary)
      } else {
        ForEach(stats.upcoming) { item in
          NavigationLink(value: destination(for: item)) {
            UpcomingRow(item: item)
          }
          .buttonStyle(.plain)
          Divider()
        }
      }
    }
    .padding()
    .background(.fill.tertiary, in: .rect(cornerRadius: 20))
  }

  private func destination(for item: UpcomingItem) -> AnyHashable {
    switch item.kind {
    case .emi: EmiRoute(id: item.parentId)
    case .deposit: InvestmentRoute(id: item.parentId)
    }
  }

  @ViewBuilder private var syncBadge: some View {
    switch sync.state {
    case .syncing: ProgressView().controlSize(.small)
    case .offline: Image(systemName: "wifi.slash").foregroundStyle(.secondary)
    case .idle, .unauthorized: EmptyView()
    }
  }
}

// Placeholder — replaced by Task 12.
struct SettingsView: View { var body: some View { Text("Settings") } }
