import Foundation

struct UpcomingItem: Identifiable {
  enum Kind { case emi, deposit }
  let id: String
  let kind: Kind
  let parentId: String
  let label: String
  let amount: Decimal
  let dueDate: Date
  let sequenceNumber: Int?
  let daysUntilDue: Int
  var isOverdue: Bool { daysUntilDue < 0 }
}

/// Pure port of getDashboardStatsImpl (src/server/dashboard.impl.ts).
/// Computed locally so the dashboard works offline; Decimal instead of the
/// server's Number() float math — differences are sub-paisa and invisible
/// after currency formatting.
struct DashboardStats {
  let netWorth: Decimal
  let invested: Decimal
  let current: Decimal
  let gainLossPercent: Double
  let monthlyEmiOutflow: Decimal
  let upcoming: [UpcomingItem]
  let allocation: [(type: String, value: Decimal, percent: Double)]

  static func compute(
    investments: [Investment], emis: [Emi], payments: [EmiPayment],
    deposits: [InvestmentDeposit], withdrawals: [InvestmentWithdrawal],
    now: Date
  ) -> DashboardStats {
    let active = investments.filter { $0.status == "active" }
    let withdrawnByInv = Dictionary(grouping: withdrawals, by: \.investmentId)
      .mapValues { $0.reduce(Decimal(0)) { $0 + $1.amount } }

    var invested: Decimal = 0
    var current: Decimal = 0
    var withdrawn: Decimal = 0
    var byType: [String: Decimal] = [:]
    for inv in active {
      invested += inv.investedAmount
      current += inv.currentValue
      withdrawn += withdrawnByInv[inv.id] ?? 0
      byType[inv.type, default: 0] += inv.currentValue
    }

    // 0 (not nil) when nothing is invested, matching dashboard.impl.ts.
    let gainLossPercent: Double = invested > 0
      ? (Double(truncating: NSDecimalNumber(
          decimal: (current + withdrawn - invested) / invested)) * 10000)
          .rounded() / 100
      : 0

    let activeEmis = emis.filter { $0.status == "active" }
    let paymentsByEmi = Dictionary(grouping: payments, by: \.emiId)
    var remainingEmiBalance: Decimal = 0
    var monthlyOutflow: Decimal = 0
    for emi in activeEmis {
      monthlyOutflow += emi.emiAmount
      // Next-unpaid payment's stored remainingBalance, not a sum of
      // emiAmounts (those include interest and overstate the liability).
      let nextUnpaid = (paymentsByEmi[emi.id] ?? [])
        .filter { $0.paymentNumber > 0 && $0.status != "paid" }
        .min { $0.paymentNumber < $1.paymentNumber }
      if let nextUnpaid { remainingEmiBalance += nextUnpaid.remainingBalance }
    }

    let totalAlloc = current
    let allocation = byType
      .map { (type: $0.key, value: $0.value,
              percent: totalAlloc > 0
                ? (Double(truncating: NSDecimalNumber(
                    decimal: $0.value / totalAlloc)) * 10000).rounded() / 100
                : 0) }
      .sorted { $0.value > $1.value }

    let horizon = now.addingTimeInterval(30 * 24 * 60 * 60)
    let emiById = Dictionary(uniqueKeysWithValues: emis.map { ($0.id, $0) })
    let upcomingEmi = payments
      .filter { $0.status != "paid" && $0.paymentNumber > 0 && $0.dueDate <= horizon }
      .sorted { $0.dueDate < $1.dueDate }
      .prefix(5)
      .compactMap { p -> UpcomingItem? in
        guard let emi = emiById[p.emiId] else { return nil }
        return UpcomingItem(
          id: p.id, kind: .emi, parentId: p.emiId, label: emi.label,
          amount: p.emiAmount, dueDate: p.dueDate,
          sequenceNumber: p.paymentNumber,
          daysUntilDue: utcDaysUntil(p.dueDate, from: now))
      }
    let scheduledActive = Dictionary(uniqueKeysWithValues:
      investments.filter { $0.mode == "scheduled" && $0.status == "active" }
        .map { ($0.id, $0) })
    let upcomingDeposits = deposits
      .filter {
        $0.status != "paid" && $0.dueDate != nil && $0.dueDate! <= horizon
          && scheduledActive[$0.investmentId] != nil
      }
      .sorted { $0.dueDate! < $1.dueDate! }
      .prefix(5)
      .map { d in
        UpcomingItem(
          id: d.id, kind: .deposit, parentId: d.investmentId,
          label: scheduledActive[d.investmentId]!.name, amount: d.amount,
          dueDate: d.dueDate!, sequenceNumber: d.installmentNumber,
          daysUntilDue: utcDaysUntil(d.dueDate!, from: now))
      }
    let upcoming = Array((upcomingEmi + upcomingDeposits)
      .sorted { $0.dueDate < $1.dueDate }
      .prefix(5))

    return DashboardStats(
      netWorth: current - remainingEmiBalance,
      invested: invested, current: current,
      gainLossPercent: gainLossPercent,
      monthlyEmiOutflow: monthlyOutflow,
      upcoming: upcoming, allocation: allocation)
  }
}
