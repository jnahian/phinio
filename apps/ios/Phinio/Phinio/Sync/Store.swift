import Foundation
import SwiftData

enum StoreError: LocalizedError, Equatable {
  case validation(String)
  var errorDescription: String? {
    if case .validation(let message) = self { return message }
    return nil
  }
}

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

  // MARK: - Investments (mirrors src/server/investments.impl.ts)

  private func deposits(of investmentId: String) throws -> [InvestmentDeposit] {
    try context.fetch(FetchDescriptor<InvestmentDeposit>(
      predicate: #Predicate { $0.investmentId == investmentId }))
  }

  private func withdrawals(of investmentId: String) throws -> [InvestmentWithdrawal] {
    try context.fetch(FetchDescriptor<InvestmentWithdrawal>(
      predicate: #Predicate { $0.investmentId == investmentId }))
  }

  @discardableResult
  func createLumpSumInvestment(
    name: String, type: String, investedAmount: Decimal, currentValue: Decimal,
    dateOfInvestment: Date, estimatedClosureDate: Date?, notes: String?
  ) throws -> Investment {
    let inv = Investment(
      id: newId(), name: name, type: type, mode: "lump_sum", status: "active",
      investedAmount: investedAmount, currentValue: currentValue,
      exitValue: nil, dateOfInvestment: dateOfInvestment, startDate: nil,
      monthlyDeposit: nil, tenureMonths: nil, interestRate: nil,
      interestType: nil, estimatedClosureDate: estimatedClosureDate,
      completedAt: nil, notes: notes, updatedAt: Date())
    context.insert(inv)
    var body: [String: Any] = [
      "id": inv.id, "name": name, "type": type,
      "investedAmount": Money.string(investedAmount),
      "currentValue": Money.string(currentValue),
      "dateOfInvestment": WireDate.dayString(dateOfInvestment),
    ]
    if let estimatedClosureDate {
      body["estimatedClosureDate"] = WireDate.dayString(estimatedClosureDate)
    }
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments", body: body)
    try context.save()
    return inv
  }

  func updateLumpSumInvestment(
    _ inv: Investment, name: String, type: String, investedAmount: Decimal,
    currentValue: Decimal, dateOfInvestment: Date, estimatedClosureDate: Date?,
    notes: String?, completed: Bool, exitValue: Decimal?, completedAt: Date?
  ) throws {
    if completed {
      guard let exitValue, let completedAt else {
        throw StoreError.validation("Exit value and completion date are required")
      }
      inv.status = "completed"
      inv.exitValue = exitValue
      inv.completedAt = completedAt
      inv.currentValue = exitValue // server collapses currentValue to exitValue
    } else {
      inv.status = "active"
      inv.exitValue = nil
      inv.completedAt = nil
      inv.currentValue = currentValue
    }
    inv.name = name
    inv.type = type
    inv.investedAmount = investedAmount
    inv.dateOfInvestment = dateOfInvestment
    inv.estimatedClosureDate = estimatedClosureDate
    inv.notes = notes
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "name": name, "type": type, "status": inv.status,
      "investedAmount": Money.string(investedAmount),
      "currentValue": Money.string(completed ? currentValue : inv.currentValue),
      "dateOfInvestment": WireDate.dayString(dateOfInvestment),
    ]
    if let estimatedClosureDate {
      body["estimatedClosureDate"] = WireDate.dayString(estimatedClosureDate)
    }
    if let notes { body["notes"] = notes }
    if completed {
      body["exitValue"] = Money.string(inv.exitValue!)
      body["completedAt"] = WireDate.dayString(inv.completedAt!)
    }
    try enqueue(method: "PATCH", path: "/api/v1/investments/\(inv.id)", body: body)
    try context.save()
  }

  func deleteInvestment(_ inv: Investment) throws {
    for d in try deposits(of: inv.id) { context.delete(d) }
    for w in try withdrawals(of: inv.id) { context.delete(w) }
    let path = "/api/v1/investments/\(inv.id)"
    context.delete(inv)
    try enqueue(method: "DELETE", path: path, body: [:])
    try context.save()
  }

  @discardableResult
  func createSavings(
    name: String, startDate: Date, currentValue: Decimal, notes: String?
  ) throws -> Investment {
    let inv = Investment(
      id: newId(), name: name, type: "savings", mode: "flexible",
      status: "active",
      investedAmount: currentValue > 0 ? currentValue : 0,
      currentValue: currentValue, exitValue: nil, dateOfInvestment: nil,
      startDate: startDate, monthlyDeposit: nil, tenureMonths: nil,
      interestRate: nil, interestType: nil, estimatedClosureDate: nil,
      completedAt: nil, notes: notes, updatedAt: Date())
    context.insert(inv)
    if currentValue > 0 { // server seeds the initial deposit the same way
      context.insert(InvestmentDeposit(
        id: newId(), investmentId: inv.id, amount: currentValue,
        dueDate: nil, depositDate: startDate, installmentNumber: nil,
        status: "paid", notes: "Initial deposit", updatedAt: Date()))
    }
    var body: [String: Any] = [
      "id": inv.id, "name": name,
      "startDate": WireDate.dayString(startDate),
      "currentValue": Money.string(currentValue),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments/savings", body: body)
    try context.save()
    return inv
  }

  func updateSavings(_ inv: Investment, name: String, currentValue: Decimal,
                     notes: String?) throws {
    inv.name = name
    inv.currentValue = currentValue
    inv.notes = notes
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "name": name, "currentValue": Money.string(currentValue),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "PATCH", path: "/api/v1/investments/savings/\(inv.id)",
                body: body)
    try context.save()
  }

  func addDeposit(to inv: Investment, amount: Decimal, depositDate: Date,
                  notes: String?) throws {
    context.insert(InvestmentDeposit(
      id: newId(), investmentId: inv.id, amount: amount, dueDate: nil,
      depositDate: depositDate, installmentNumber: nil, status: "paid",
      notes: notes, updatedAt: Date()))
    inv.investedAmount += amount
    inv.currentValue += amount
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "amount": Money.string(amount),
      "depositDate": WireDate.dayString(depositDate),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST",
                path: "/api/v1/investments/savings/\(inv.id)/deposits", body: body)
    try context.save()
  }

  func removeDeposit(_ dep: InvestmentDeposit, from inv: Investment) throws {
    let path = "/api/v1/deposits/\(dep.id)"
    let removed = dep.amount
    context.delete(dep)
    // Server re-syncs investedAmount = SUM(remaining), currentValue clamped.
    let remaining = try deposits(of: inv.id).reduce(Decimal(0)) { $0 + $1.amount }
    inv.investedAmount = remaining
    inv.currentValue = max(0, inv.currentValue - removed)
    inv.updatedAt = Date()
    try enqueue(method: "DELETE", path: path, body: [:])
    try context.save()
  }

  func withdraw(from inv: Investment, amount: Decimal, withdrawalDate: Date,
                notes: String?, closeInvestment: Bool) throws {
    guard inv.mode != "scheduled" else {
      throw StoreError.validation("Use premature closure for DPS schemes")
    }
    guard inv.status == "active" else {
      throw StoreError.validation("Investment is not active")
    }
    guard amount <= inv.currentValue else {
      throw StoreError.validation("Withdrawal amount exceeds current value")
    }
    let resulting = inv.currentValue - amount
    if closeInvestment && resulting != 0 {
      throw StoreError.validation("Only full withdrawals can close an investment")
    }
    context.insert(InvestmentWithdrawal(
      id: newId(), investmentId: inv.id, amount: amount,
      withdrawalDate: withdrawalDate, notes: notes))
    inv.currentValue = resulting
    if closeInvestment || resulting == 0 {
      inv.status = "completed"
      inv.exitValue = try withdrawals(of: inv.id).reduce(Decimal(0)) { $0 + $1.amount }
      inv.completedAt = withdrawalDate
    }
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "amount": Money.string(amount),
      "withdrawalDate": WireDate.dayString(withdrawalDate),
    ]
    if let notes { body["notes"] = notes }
    if closeInvestment { body["closeInvestment"] = true }
    try enqueue(method: "POST", path: "/api/v1/investments/\(inv.id)/withdraw",
                body: body)
    try context.save()
  }

  @discardableResult
  func createDps(
    name: String, monthlyDeposit: Decimal, tenureMonths: Int,
    interestRate: Decimal, interestType: String, startDate: Date, notes: String?
  ) throws -> Investment {
    // ponytail: installment schedule is server-generated (generateDpsSchedule
    // is not ported); rows arrive with the first snapshot after sync.
    let inv = Investment(
      id: newId(), name: name, type: "dps", mode: "scheduled", status: "active",
      investedAmount: 0, currentValue: 0, exitValue: nil, dateOfInvestment: nil,
      startDate: startDate, monthlyDeposit: monthlyDeposit,
      tenureMonths: tenureMonths, interestRate: interestRate,
      interestType: interestType, estimatedClosureDate: nil, completedAt: nil,
      notes: notes, updatedAt: Date())
    context.insert(inv)
    var body: [String: Any] = [
      "id": inv.id, "name": name,
      "monthlyDeposit": Money.string(monthlyDeposit),
      "tenureMonths": tenureMonths,
      "interestRate": Money.string(interestRate),
      "interestType": interestType,
      "startDate": WireDate.dayString(startDate),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments/dps", body: body)
    try context.save()
    return inv
  }

  func updateDps(_ inv: Investment, name: String, notes: String?) throws {
    inv.name = name
    inv.notes = notes
    inv.updatedAt = Date()
    var body: [String: Any] = ["name": name]
    if let notes { body["notes"] = notes }
    try enqueue(method: "PATCH", path: "/api/v1/investments/dps/\(inv.id)",
                body: body)
    try context.save()
  }

  func markDepositPaid(_ dep: InvestmentDeposit, investment inv: Investment,
                       paid: Bool) throws {
    // Note: InvestmentDeposit has no paidAt property (the server tracks it);
    // status alone drives all local UI.
    dep.status = paid ? "paid" : "upcoming"
    dep.updatedAt = Date()
    // Server re-syncs both totals to SUM(paid deposits).
    let paidSum = try deposits(of: inv.id)
      .filter { $0.status == "paid" }
      .reduce(Decimal(0)) { $0 + $1.amount }
    inv.investedAmount = paidSum
    inv.currentValue = paidSum
    let unpaidRemain = try deposits(of: inv.id).contains { $0.status != "paid" }
    if paid && !unpaidRemain {
      inv.status = "matured"
    } else if !paid && inv.status == "matured" {
      inv.status = "active"
    }
    inv.updatedAt = Date()
    try enqueue(method: "POST", path: "/api/v1/deposits/\(dep.id)/mark-paid",
                body: ["paid": paid])
    try context.save()
  }

  func closeDps(_ inv: Investment, receivedAmount: Decimal, closureDate: Date,
                notes: String?) throws {
    guard inv.status == "active" else {
      throw StoreError.validation("DPS is not active")
    }
    let note = "Premature closure." + (notes.map { " \($0)" } ?? "")
    context.insert(InvestmentWithdrawal(
      id: newId(), investmentId: inv.id, amount: receivedAmount,
      withdrawalDate: closureDate, notes: note))
    for d in try deposits(of: inv.id) where d.status == "upcoming" {
      context.delete(d)
    }
    inv.currentValue = 0
    inv.exitValue = receivedAmount
    inv.status = "closed"
    inv.completedAt = closureDate
    inv.updatedAt = Date()
    var body: [String: Any] = [
      "receivedAmount": Money.string(receivedAmount),
      "closureDate": WireDate.dayString(closureDate),
    ]
    if let notes { body["notes"] = notes }
    try enqueue(method: "POST", path: "/api/v1/investments/dps/\(inv.id)/close",
                body: body)
    try context.save()
  }
}
