import Foundation
import Testing
@testable import Phinio

struct DashboardStatsTests {
  private let now = WireDate.timestamp("2026-07-17T10:00:00.000Z")!

  private func investment(_ id: String, type: String, invested: String,
                          current: String, status: String = "active",
                          mode: String = "lump_sum") -> Investment {
    Investment(id: id, name: id, type: type, mode: mode, status: status,
      investedAmount: Money.decimal(invested)!,
      currentValue: Money.decimal(current)!, exitValue: nil,
      dateOfInvestment: nil, startDate: nil, monthlyDeposit: nil,
      tenureMonths: nil, interestRate: nil, interestType: nil,
      estimatedClosureDate: nil, completedAt: nil, notes: nil, updatedAt: now)
  }

  @Test func formulasMirrorTheServer() {
    let invs = [
      investment("a", type: "gold", invested: "1000", current: "1200"),
      investment("b", type: "stock", invested: "500", current: "300"),
      investment("c", type: "gold", invested: "999", current: "999",
                 status: "completed"), // excluded
    ]
    let wd = [InvestmentWithdrawal(id: "w1", investmentId: "a",
      amount: Money.decimal("100")!, withdrawalDate: now, notes: nil)]
    let emi = Emi(id: "e1", label: "Loan", type: "bank_loan",
      principal: Money.decimal("10000")!, interestRate: Money.decimal("10")!,
      tenureMonths: 12, emiAmount: Money.decimal("879.16")!,
      startDate: now, status: "active", notes: nil, updatedAt: now)
    let pay = [
      EmiPayment(id: "p1", emiId: "e1", paymentNumber: 1,
        dueDate: WireDate.day("2026-07-20")!, emiAmount: Money.decimal("879.16")!,
        principalComponent: Money.decimal("795.83")!,
        interestComponent: Money.decimal("83.33")!,
        remainingBalance: Money.decimal("9204.17")!, status: "upcoming",
        paidAt: nil, updatedAt: now),
      EmiPayment(id: "p2", emiId: "e1", paymentNumber: 2,
        dueDate: WireDate.day("2026-08-20")!, emiAmount: Money.decimal("879.16")!,
        principalComponent: Money.decimal("802.46")!,
        interestComponent: Money.decimal("76.70")!,
        remainingBalance: Money.decimal("8401.71")!, status: "upcoming",
        paidAt: nil, updatedAt: now),
    ]
    let s = DashboardStats.compute(investments: invs, emis: [emi],
      payments: pay, deposits: [], withdrawals: wd, now: now)
    #expect(s.invested == Money.decimal("1500"))
    #expect(s.current == Money.decimal("1500"))
    // (1500 + 100 − 1500) / 1500 = 6.67%
    #expect(s.gainLossPercent == 6.67)
    #expect(s.monthlyEmiOutflow == Money.decimal("879.16"))
    // netWorth = 1500 − next-unpaid remainingBalance (9204.17). Negated from a
    // positive: Money.decimal only parses non-negative wire money.
    #expect(s.netWorth == -Money.decimal("7704.17")!)
    #expect(s.allocation.first?.type == "gold")
    #expect(s.allocation.first?.percent == 80.0)
    // Only p1 is within 30 days (Aug 20 is 34 days out)
    #expect(s.upcoming.map(\.id) == ["p1"])
    #expect(s.upcoming[0].daysUntilDue == 3)
    #expect(!s.upcoming[0].isOverdue)
  }

  @Test func emptyPortfolioHasNilGainAndZeroes() {
    let s = DashboardStats.compute(investments: [], emis: [], payments: [],
      deposits: [], withdrawals: [], now: now)
    #expect(s.gainLossPercent == nil)
    #expect(s.netWorth == 0 && s.upcoming.isEmpty && s.allocation.isEmpty)
  }

  @Test func upcomingMergesDpsDepositsAndSortsByDueDate() {
    let dps = investment("d1", type: "dps", invested: "0", current: "0",
                         mode: "scheduled")
    let dep = InvestmentDeposit(id: "dd1", investmentId: "d1",
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-07-16")!,
      depositDate: nil, installmentNumber: 3, status: "upcoming", notes: nil,
      updatedAt: now)
    let s = DashboardStats.compute(investments: [dps], emis: [], payments: [],
      deposits: [dep], withdrawals: [], now: now)
    #expect(s.upcoming.count == 1)
    #expect(s.upcoming[0].kind == .deposit)
    #expect(s.upcoming[0].isOverdue) // due yesterday
    #expect(s.upcoming[0].sequenceNumber == 3)
  }
}
