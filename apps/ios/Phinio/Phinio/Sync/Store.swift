import Foundation
import SwiftData

/// The app's single write API: every user mutation applies to SwiftData
/// immediately AND appends one PendingMutation whose body matches the
/// server's validator schema. UI never talks to the network.
@MainActor
struct Store {
  let context: ModelContext

  private func newId() -> String { UUID().uuidString.lowercased() }

  private func enqueue(method: String, path: String, body: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: body)
    context.insert(PendingMutation(
      id: UUID(), method: method, path: path, body: data,
      createdAt: Date(), attemptCount: 0))
  }

  @discardableResult
  func createEmi(
    label: String, type: EmiMethod, principal: Decimal, interestRate: Decimal,
    tenureMonths: Int, startDate: Date, notes: String?
  ) throws -> Emi {
    let rows = try EmiCalculator.amortization(
      principal: NSDecimalNumber(decimal: principal).doubleValue,
      annualRate: NSDecimalNumber(decimal: interestRate).doubleValue,
      tenureMonths: tenureMonths, startDate: startDate, type: type)

    let emiId = newId()
    let now = Date()
    let emi = Emi(
      id: emiId, label: label, type: type.rawValue, principal: principal,
      interestRate: interestRate, tenureMonths: tenureMonths,
      emiAmount: Money.decimal(rows[0].emiAmount) ?? 0,
      startDate: startDate, status: "active", notes: notes, updatedAt: now)
    context.insert(emi)

    var paymentIds: [String] = []
    for row in rows {
      let paymentId = newId()
      paymentIds.append(paymentId)
      context.insert(EmiPayment(
        id: paymentId, emiId: emiId, paymentNumber: row.paymentNumber,
        dueDate: row.dueDate,
        emiAmount: Money.decimal(row.emiAmount) ?? 0,
        principalComponent: Money.decimal(row.principalComponent) ?? 0,
        interestComponent: Money.decimal(row.interestComponent) ?? 0,
        remainingBalance: Money.decimal(row.remainingBalance) ?? 0,
        status: "upcoming", paidAt: nil, updatedAt: now))
    }

    var body: [String: Any] = [
      "id": emiId,
      "label": label,
      "type": type.rawValue,
      "principal": Money.string(principal),
      "interestRate": Money.string(interestRate),
      "tenureMonths": tenureMonths,
      "startDate": WireDate.dayString(startDate),
      "paymentIds": paymentIds,
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/emis", body: body)
    try context.save()
    return emi
  }

  func markPaymentPaid(_ payment: EmiPayment, paid: Bool) throws {
    payment.status = paid ? "paid" : "upcoming"
    payment.paidAt = paid ? Date() : nil
    payment.updatedAt = Date()
    try enqueue(
      method: "POST",
      path: "/api/v1/emi-payments/\(payment.id)/mark-paid",
      body: ["paid": paid])
    try context.save()
  }
}
