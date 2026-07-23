import Foundation
import SwiftData
import Testing
@testable import Phinio

@MainActor
struct StoreInvestmentTests {
  // Container must outlive the test — ModelContext does not retain it.
  private func makeStore() throws -> (Store, ModelContainer) {
    let container = try makeModelContainer(inMemory: true)
    return (Store(context: container.mainContext), container)
  }

  private func outbox(_ ctx: ModelContext) throws -> [PendingMutation] {
    try ctx.fetch(FetchDescriptor<PendingMutation>(
      sortBy: [SortDescriptor(\.createdAt, order: .forward)]))
  }

  private func body(_ m: PendingMutation) throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: m.body!) as! [String: Any]
  }

  @Test func savingsCreateSeedsInitialDeposit() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createSavings(
      name: "Rainy day", startDate: WireDate.day("2026-01-01")!,
      currentValue: Money.decimal("500")!, notes: nil)
    #expect(inv.type == "savings" && inv.mode == "flexible")
    #expect(inv.investedAmount == Money.decimal("500"))
    let deps = try ctx.fetch(FetchDescriptor<InvestmentDeposit>())
    #expect(deps.count == 1 && deps[0].status == "paid")
    let b = try body(try outbox(ctx)[0])
    #expect(b["currentValue"] as? String == "500.00")
    #expect(b["startDate"] as? String == "2026-01-01")
  }

  @Test func depositAndRemovalKeepTotalsSynced() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createSavings(
      name: "S", startDate: Date(), currentValue: 0, notes: nil)
    try store.addDeposit(to: inv, amount: Money.decimal("100")!,
                         depositDate: Date(), notes: nil)
    #expect(inv.investedAmount == 100 && inv.currentValue == 100)
    let dep = try ctx.fetch(FetchDescriptor<InvestmentDeposit>()).first!
    try store.removeDeposit(dep, from: inv)
    #expect(inv.investedAmount == 0 && inv.currentValue == 0)
    let last = try outbox(ctx).last!
    #expect(last.method == "DELETE")
    #expect(last.path == "/api/v1/deposits/\(dep.id)")
  }

  @Test func withdrawGuardsAndCloses() throws {
    let (store, container) = try makeStore()
    let inv = try store.createSavings(
      name: "S", startDate: Date(), currentValue: Money.decimal("100")!, notes: nil)
    #expect(throws: StoreError.self) {
      try store.withdraw(from: inv, amount: Money.decimal("150")!,
                         withdrawalDate: Date(), notes: nil, closeInvestment: false)
    }
    #expect(throws: StoreError.self) { // partial cannot close
      try store.withdraw(from: inv, amount: Money.decimal("40")!,
                         withdrawalDate: Date(), notes: nil, closeInvestment: true)
    }
    try store.withdraw(from: inv, amount: Money.decimal("100")!,
                       withdrawalDate: WireDate.day("2026-03-01")!,
                       notes: nil, closeInvestment: true)
    #expect(inv.status == "completed")
    #expect(inv.currentValue == 0)
    #expect(inv.exitValue == 100)
    let wds = try container.mainContext.fetch(FetchDescriptor<InvestmentWithdrawal>())
    #expect(wds.count == 1)
  }

  @Test func dpsMarkPaidResyncsAndMatures() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createDps(
      name: "DPS", monthlyDeposit: Money.decimal("1000")!, tenureMonths: 2,
      interestRate: Money.decimal("8")!, interestType: "compound",
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    // Simulate server-generated installments arriving via snapshot:
    let d1 = InvestmentDeposit(id: "d1", investmentId: inv.id,
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-01-01"),
      depositDate: nil, installmentNumber: 1, status: "upcoming",
      notes: nil, updatedAt: Date())
    let d2 = InvestmentDeposit(id: "d2", investmentId: inv.id,
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-02-01"),
      depositDate: nil, installmentNumber: 2, status: "upcoming",
      notes: nil, updatedAt: Date())
    ctx.insert(d1); ctx.insert(d2); try ctx.save()

    try store.markDepositPaid(d1, investment: inv, paid: true)
    #expect(inv.currentValue == 1000 && inv.investedAmount == 1000)
    #expect(inv.status == "active")
    try store.markDepositPaid(d2, investment: inv, paid: true)
    #expect(inv.status == "matured")
    try store.markDepositPaid(d2, investment: inv, paid: false)
    #expect(inv.status == "active" && inv.currentValue == 1000)
    let last = try outbox(ctx).last!
    #expect(last.path == "/api/v1/deposits/d2/mark-paid")
    #expect(try (body(last)["paid"] as? Bool) == false)
  }

  @Test func dpsCloseDropsUpcomingAndRecordsExit() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let inv = try store.createDps(
      name: "DPS", monthlyDeposit: Money.decimal("1000")!, tenureMonths: 2,
      interestRate: Money.decimal("8")!, interestType: "simple",
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    ctx.insert(InvestmentDeposit(id: "u1", investmentId: inv.id,
      amount: Money.decimal("1000")!, dueDate: WireDate.day("2026-02-01"),
      depositDate: nil, installmentNumber: 2, status: "upcoming",
      notes: nil, updatedAt: Date()))
    try ctx.save()
    try store.closeDps(inv, receivedAmount: Money.decimal("980")!,
                       closureDate: WireDate.day("2026-01-15")!, notes: "early")
    #expect(inv.status == "closed" && inv.exitValue == Money.decimal("980"))
    #expect(inv.currentValue == 0)
    #expect(try ctx.fetch(FetchDescriptor<InvestmentDeposit>()).isEmpty)
    #expect(try ctx.fetch(FetchDescriptor<InvestmentWithdrawal>()).count == 1)
  }

  @Test func lumpSumCompleteCollapsesCurrentValue() throws {
    let (store, container) = try makeStore()
    let inv = try store.createLumpSumInvestment(
      name: "Gold", type: "gold", investedAmount: Money.decimal("1000")!,
      currentValue: Money.decimal("1200")!,
      dateOfInvestment: WireDate.day("2026-01-01")!,
      estimatedClosureDate: nil, notes: nil)
    try store.updateLumpSumInvestment(inv,
      name: "Gold", type: "gold", investedAmount: Money.decimal("1000")!,
      currentValue: Money.decimal("1200")!,
      dateOfInvestment: WireDate.day("2026-01-01")!,
      estimatedClosureDate: nil, notes: nil,
      completed: true, exitValue: Money.decimal("1300")!,
      completedAt: WireDate.day("2026-06-01")!)
    #expect(inv.status == "completed")
    #expect(inv.currentValue == Money.decimal("1300")) // collapses to exitValue
    let last = try container.mainContext
      .fetch(FetchDescriptor<PendingMutation>(sortBy: [SortDescriptor(\.createdAt)])).last!
    #expect(last.method == "PATCH")
    let b = try JSONSerialization.jsonObject(with: last.body!) as! [String: Any]
    #expect(b["status"] as? String == "completed")
    #expect(b["exitValue"] as? String == "1300.00")
  }
}
