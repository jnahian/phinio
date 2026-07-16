import Foundation
import Testing
@testable import Phinio

private struct Fixture: Decodable {
  struct Input: Decodable {
    let principal: String
    let annualRate: String
    let tenureMonths: Int
    let startDate: String
    let type: String?
  }
  struct Breakdown: Decodable {
    let emiAmount, totalPayment, totalInterest: String
  }
  struct Row: Decodable {
    let paymentNumber: Int
    let dueDate: String
    let emiAmount, principalComponent, interestComponent, remainingBalance: String
  }
  let name: String
  let input: Input
  let breakdown: Breakdown
  let rows: [Row]
}

private func loadFixtures() throws -> [Fixture] {
  let url = Bundle(for: BundleToken.self)
    .url(forResource: "emi-fixtures", withExtension: "json")!
  return try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
}

private final class BundleToken {}

struct EmiCalculatorTests {
  @Test func matchesTypeScriptFixturesToThePaisa() throws {
    let fixtures = try loadFixtures()
    #expect(fixtures.count >= 7)
    for f in fixtures {
      let type = EmiMethod(rawValue: f.input.type ?? "bank_loan")!
      let principal = Double(f.input.principal)!
      let rate = Double(f.input.annualRate)!

      let breakdown = try EmiCalculator.calculate(
        principal: principal, annualRate: rate,
        tenureMonths: f.input.tenureMonths, type: type)
      #expect(breakdown.emiAmount == f.breakdown.emiAmount, "\(f.name) emi")
      #expect(breakdown.totalPayment == f.breakdown.totalPayment, "\(f.name) total")
      #expect(breakdown.totalInterest == f.breakdown.totalInterest, "\(f.name) interest")

      let rows = try EmiCalculator.amortization(
        principal: principal, annualRate: rate,
        tenureMonths: f.input.tenureMonths,
        startDate: WireDate.day(f.input.startDate)!, type: type)
      #expect(rows.count == f.rows.count, "\(f.name)")
      for (got, want) in zip(rows, f.rows) {
        #expect(got.paymentNumber == want.paymentNumber, "\(f.name)")
        #expect(WireDate.dayString(got.dueDate) == want.dueDate, "\(f.name) #\(want.paymentNumber) date")
        #expect(got.emiAmount == want.emiAmount, "\(f.name) #\(want.paymentNumber) amount")
        #expect(got.principalComponent == want.principalComponent, "\(f.name) #\(want.paymentNumber) principal")
        #expect(got.interestComponent == want.interestComponent, "\(f.name) #\(want.paymentNumber) interest")
        #expect(got.remainingBalance == want.remainingBalance, "\(f.name) #\(want.paymentNumber) balance")
      }
      #expect(rows.last?.remainingBalance == "0.00", "\(f.name)")
    }
  }

  @Test func rejectsInvalidInputs() {
    #expect(throws: (any Error).self) {
      _ = try EmiCalculator.calculate(principal: 0, annualRate: 10, tenureMonths: 12, type: .bankLoan)
    }
    #expect(throws: (any Error).self) {
      _ = try EmiCalculator.calculate(principal: 1000, annualRate: -1, tenureMonths: 12, type: .bankLoan)
    }
    #expect(throws: (any Error).self) {
      _ = try EmiCalculator.calculate(principal: 1000, annualRate: 10, tenureMonths: 0, type: .bankLoan)
    }
  }
}
