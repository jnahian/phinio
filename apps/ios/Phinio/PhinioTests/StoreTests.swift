import Foundation
import SwiftData
import Testing
@testable import Phinio

@MainActor
struct ModelContainerTests {
  @Test func containerHoldsAllModelsAndPersistsDecimals() throws {
    let container = try makeModelContainer(inMemory: true)
    let context = container.mainContext

    let emi = Emi(
      id: UUID().uuidString.lowercased(), label: "Test", type: "bank_loan",
      principal: Money.decimal("100000")!, interestRate: Money.decimal("12")!,
      tenureMonths: 12, emiAmount: Money.decimal("8884.88")!,
      startDate: WireDate.day("2026-01-15")!, status: "active", notes: nil,
      updatedAt: Date())
    context.insert(emi)
    try context.save()

    let fetched = try context.fetch(FetchDescriptor<Emi>()).first
    #expect(fetched?.principal == Money.decimal("100000"))
    #expect(Money.string(fetched!.emiAmount) == "8884.88")

    context.insert(PendingMutation(
      id: UUID(), method: "POST", path: "/api/v1/emis", body: Data(),
      createdAt: Date(), attemptCount: 0))
    try context.save()
    #expect(try context.fetchCount(FetchDescriptor<PendingMutation>()) == 1)
  }
}

@MainActor
struct StoreTests {
  private func makeStore() throws -> (Store, ModelContext) {
    let container = try makeModelContainer(inMemory: true)
    return (Store(context: container.mainContext), container.mainContext)
  }

  @Test func createEmiGeneratesScheduleAndOneOutboxRow() throws {
    let (store, context) = try makeStore()
    let emi = try store.createEmi(
      label: "Car loan", type: .bankLoan,
      principal: Money.decimal("100000")!, interestRate: Money.decimal("12")!,
      tenureMonths: 12, startDate: WireDate.day("2026-01-15")!, notes: nil)

    let payments = try context.fetch(FetchDescriptor<EmiPayment>())
    #expect(payments.count == 12)
    #expect(payments.allSatisfy { $0.emiId == emi.id })
    #expect(Money.string(emi.emiAmount) == "8884.88")

    let outbox = try context.fetch(FetchDescriptor<PendingMutation>())
    #expect(outbox.count == 1)
    #expect(outbox[0].method == "POST")
    #expect(outbox[0].path == "/api/v1/emis")
    let body = try JSONSerialization.jsonObject(with: outbox[0].body!) as! [String: Any]
    #expect(body["id"] as? String == emi.id)
    #expect(body["principal"] as? String == "100000.00")
    #expect(body["startDate"] as? String == "2026-01-15")
    #expect((body["paymentIds"] as? [String])?.count == 12)
    #expect(body["tenureMonths"] as? Int == 12)
  }

  @Test func markPaymentPaidFlipsStatusAndEnqueues() throws {
    let (store, context) = try makeStore()
    let emi = try store.createEmi(
      label: "Loan", type: .bankLoan,
      principal: Money.decimal("12000")!, interestRate: Money.decimal("10")!,
      tenureMonths: 3, startDate: WireDate.day("2026-02-01")!, notes: nil)
    _ = emi
    // Clear the create mutation to isolate the mark-paid one.
    for m in try context.fetch(FetchDescriptor<PendingMutation>()) { context.delete(m) }
    try context.save()

    let payment = try context.fetch(FetchDescriptor<EmiPayment>())
      .sorted { $0.paymentNumber < $1.paymentNumber }.first!
    try store.markPaymentPaid(payment, paid: true)

    #expect(payment.status == "paid")
    #expect(payment.paidAt != nil)
    let outbox = try context.fetch(FetchDescriptor<PendingMutation>())
    #expect(outbox.count == 1)
    #expect(outbox[0].path == "/api/v1/emi-payments/\(payment.id)/mark-paid")
    let body = try JSONSerialization.jsonObject(with: outbox[0].body!) as! [String: Any]
    #expect(body["paid"] as? Bool == true)
  }
}
