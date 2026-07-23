import Foundation
import SwiftData
import Testing
@testable import Phinio

@MainActor
struct StoreEmiTests {
  private func makeStore() throws -> (Store, ModelContainer) {
    let container = try makeModelContainer(inMemory: true)
    return (Store(context: container.mainContext), container)
  }

  @Test func processingFeeInsertsSentinelRowAndWiresBody() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    _ = try store.createEmi(
      label: "Loan", type: .bankLoan, principal: Money.decimal("12000")!,
      interestRate: Money.decimal("10")!, tenureMonths: 3,
      startDate: WireDate.day("2026-02-01")!, notes: nil,
      processingFee: Money.decimal("500")!)
    let payments = try ctx.fetch(FetchDescriptor<EmiPayment>())
    #expect(payments.count == 4) // 3 + fee sentinel
    let fee = payments.first { $0.paymentNumber == 0 }!
    #expect(fee.status == "paid" && fee.emiAmount == Money.decimal("500"))
    let m = try ctx.fetch(FetchDescriptor<PendingMutation>()).first!
    let b = try JSONSerialization.jsonObject(with: m.body!) as! [String: Any]
    #expect(b["processingFee"] as? String == "500.00")
    #expect(b["processingFeeId"] as? String == fee.id)
    #expect((b["paymentIds"] as? [String])?.count == 3) // fee id NOT in paymentIds
  }

  @Test func markPaidRejectsFeeRowAndAutoCompletes() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let emi = try store.createEmi(
      label: "L", type: .bankLoan, principal: Money.decimal("1000")!,
      interestRate: Money.decimal("0")!, tenureMonths: 2,
      startDate: WireDate.day("2026-01-01")!, notes: nil,
      processingFee: Money.decimal("50")!)
    let payments = try ctx.fetch(FetchDescriptor<EmiPayment>())
      .sorted { $0.paymentNumber < $1.paymentNumber }
    #expect(throws: StoreError.self) {
      try store.markPaymentPaid(payments[0], paid: true) // fee row
    }
    try store.markPaymentPaid(payments[1], paid: true)
    #expect(emi.status == "active")
    try store.markPaymentPaid(payments[2], paid: true)
    #expect(emi.status == "completed") // auto-complete
    try store.markPaymentPaid(payments[2], paid: false)
    #expect(emi.status == "active") // reopen
  }

  @Test func completeEmiMarksRemainingRegularPayments() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let emi = try store.createEmi(
      label: "L", type: .creditCard, principal: Money.decimal("5000")!,
      interestRate: Money.decimal("24")!, tenureMonths: 3,
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    try store.completeEmi(emi)
    #expect(emi.status == "completed")
    let unpaid = try ctx.fetch(FetchDescriptor<EmiPayment>())
      .filter { $0.paymentNumber > 0 && $0.status != "paid" }
    #expect(unpaid.isEmpty)
    let last = try ctx.fetch(FetchDescriptor<PendingMutation>(
      sortBy: [SortDescriptor(\.createdAt)])).last!
    #expect(last.path == "/api/v1/emis/\(emi.id)/complete")
  }

  @Test func deleteEmiRemovesPaymentsToo() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let emi = try store.createEmi(
      label: "L", type: .bankLoan, principal: Money.decimal("1000")!,
      interestRate: Money.decimal("5")!, tenureMonths: 2,
      startDate: WireDate.day("2026-01-01")!, notes: nil)
    try store.deleteEmi(emi)
    #expect(try ctx.fetch(FetchDescriptor<Emi>()).isEmpty)
    #expect(try ctx.fetch(FetchDescriptor<EmiPayment>()).isEmpty)
  }

  @Test func notificationOpsFlipLocallyAndEnqueue() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let n1 = AppNotification(id: "n1", type: "emi.payment.due", title: "t",
      body: "b", link: nil, readAt: nil, createdAt: Date())
    let n2 = AppNotification(id: "n2", type: "emi.payment.due", title: "t",
      body: "b", link: nil, readAt: Date(), createdAt: Date())
    ctx.insert(n1); ctx.insert(n2); try ctx.save()
    try store.markNotificationRead(n1)
    #expect(n1.readAt != nil)
    try store.clearReadNotifications()
    #expect(try ctx.fetch(FetchDescriptor<AppNotification>()).isEmpty)
    let paths = try ctx.fetch(FetchDescriptor<PendingMutation>(
      sortBy: [SortDescriptor(\.createdAt)])).map(\.path)
    #expect(paths == ["/api/v1/notifications/n1/read",
                      "/api/v1/notifications/clear-read"])
  }

  @Test func profilePatchSendsAllThreeFields() throws {
    let (store, container) = try makeStore()
    let ctx = container.mainContext
    let p = Profile(id: "p1", fullName: "Old", preferredCurrency: "BDT",
                    preferredLanguage: "en", updatedAt: Date())
    ctx.insert(p); try ctx.save()
    try store.updateProfile(p, fullName: "New Name",
                            preferredCurrency: "USD", preferredLanguage: "bn")
    #expect(p.fullName == "New Name" && p.preferredCurrency == "USD")
    let m = try ctx.fetch(FetchDescriptor<PendingMutation>()).first!
    #expect(m.method == "PATCH" && m.path == "/api/v1/profile")
    let b = try JSONSerialization.jsonObject(with: m.body!) as! [String: Any]
    #expect(b["preferredLanguage"] as? String == "bn")
  }
}
