import Foundation

/// Port of src/lib/emi-calculator.ts (PRD §9.2). Deliberately computes in
/// Double with the same operations in the same order as the TS original so
/// offline-created schedules match the server to the paisa — proven by
/// PhinioTests/Fixtures/emi-fixtures.json. Do not "upgrade" this to Decimal.
enum EmiMethod: String {
  case bankLoan = "bank_loan"
  case creditCard = "credit_card"
}

struct EmiBreakdown {
  let emiAmount: String
  let totalPayment: String
  let totalInterest: String
}

struct AmortizationRow {
  let paymentNumber: Int
  let dueDate: Date
  let emiAmount: String
  let principalComponent: String
  let interestComponent: String
  let remainingBalance: String
}

enum EmiCalculatorError: Error {
  case invalidPrincipal, invalidRate, invalidTenure
}

enum EmiCalculator {
  static let feePaymentNumber = 0

  /// Matches JS `Math.round(value * 100) / 100` (half-up for positives).
  private static func round2(_ value: Double) -> Double {
    (value * 100).rounded(.toNearestOrAwayFromZero) / 100
  }

  /// Matches JS `x.toFixed(2)` for the already-round2'ed values we emit.
  private static func fixed2(_ value: Double) -> String {
    let cents = Int((value * 100).rounded(.toNearestOrAwayFromZero))
    return String(format: "%d.%02d", cents / 100, abs(cents % 100))
  }

  static func calculate(
    principal: Double, annualRate: Double, tenureMonths: Int, type: EmiMethod
  ) throws -> EmiBreakdown {
    guard principal.isFinite, principal > 0 else { throw EmiCalculatorError.invalidPrincipal }
    guard annualRate.isFinite, annualRate >= 0 else { throw EmiCalculatorError.invalidRate }
    guard tenureMonths > 0 else { throw EmiCalculatorError.invalidTenure }

    let n = Double(tenureMonths)
    let r = annualRate / 12 / 100

    let emi: Double
    if r == 0 {
      emi = principal / n
    } else if type == .creditCard {
      emi = principal / n + principal * r
    } else {
      let pow = Foundation.pow(1 + r, n)
      emi = (principal * r * pow) / (pow - 1)
    }

    let emiRounded = round2(emi)
    let totalPayment = round2(emiRounded * n)
    let totalInterest = round2(totalPayment - principal)
    return EmiBreakdown(
      emiAmount: fixed2(emiRounded),
      totalPayment: fixed2(totalPayment),
      totalInterest: fixed2(totalInterest))
  }

  /// Add calendar months in UTC, clamping to end-of-month like the TS
  /// original (Jan 31 + 1 → Feb 28/29).
  private static func addMonths(_ date: Date, _ months: Int) -> Date {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "UTC")!
    let parts = cal.dateComponents([.year, .month, .day], from: date)
    let year = parts.year!, month = parts.month!, day = parts.day!

    let zeroBased = (month - 1) + months
    let targetYear = year + Int(floor(Double(zeroBased) / 12))
    let targetMonth = ((zeroBased % 12) + 12) % 12 + 1

    var target = DateComponents(year: targetYear, month: targetMonth, day: 1)
    let firstOfMonth = cal.date(from: target)!
    let daysInMonth = cal.range(of: .day, in: .month, for: firstOfMonth)!.count
    target.day = min(day, daysInMonth)
    return cal.date(from: target)!
  }

  static func amortization(
    principal: Double, annualRate: Double, tenureMonths: Int,
    startDate: Date, type: EmiMethod
  ) throws -> [AmortizationRow] {
    let breakdown = try calculate(
      principal: principal, annualRate: annualRate,
      tenureMonths: tenureMonths, type: type)
    let emi = Double(breakdown.emiAmount)!
    let r = annualRate / 12 / 100
    let isFlat = type == .creditCard

    var rows: [AmortizationRow] = []
    var balance = principal

    for i in 1...tenureMonths {
      let isLast = i == tenureMonths
      let interestComponent = round2(isFlat ? principal * r : balance * r)
      let principalComponent: Double
      let paymentAmount: Double

      if isLast {
        principalComponent = round2(balance)
        paymentAmount = round2(principalComponent + interestComponent)
        balance = 0
      } else {
        principalComponent = max(0, round2(emi - interestComponent))
        paymentAmount = emi
        balance = round2(balance - principalComponent)
      }

      rows.append(AmortizationRow(
        paymentNumber: i,
        dueDate: addMonths(startDate, i - 1),
        emiAmount: fixed2(paymentAmount),
        principalComponent: fixed2(principalComponent),
        interestComponent: fixed2(interestComponent),
        remainingBalance: fixed2(balance)))
    }
    return rows
  }
}
