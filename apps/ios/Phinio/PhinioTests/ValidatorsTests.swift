import Foundation
import Testing

@testable import Phinio

struct ValidatorsTests {
  @Test func moneyRulesMirrorTheZodSchemas() {
    #expect(Validate.money("100.50") == Money.decimal("100.50"))
    #expect(Validate.money("0") == 0)
    #expect(Validate.money("1.234") == nil)  // >2 dp
    #expect(Validate.money("-5") == nil)  // sign not in regex
    #expect(Validate.money("1,000") == nil)
    #expect(Validate.money(" 100 ") == Money.decimal("100"))  // trimmed first
    #expect(Validate.positiveMoney("0") == nil)
    #expect(Validate.positiveMoney("0.01") == Money.decimal("0.01"))
    #expect(Validate.nonNegativeMoney("0") == 0)
    #expect(Validate.rate("99.99") == Money.decimal("99.99"))
    #expect(Validate.rate("100") == nil)  // < 100
    #expect(Validate.rate("0") == 0)
  }

  @Test func nameAndNotesTrimAndBound() {
    #expect(Validate.name("  Car loan  ") == "Car loan")
    #expect(Validate.name("   ") == nil)
    #expect(Validate.name(String(repeating: "x", count: 121)) == nil)
    #expect(Validate.notes("") == .some(nil))  // empty → omit from body
    #expect(Validate.notes("hi") == "hi")
    #expect(Validate.notes(String(repeating: "x", count: 1001)) == nil)
  }

  @Test func utcDayMathMatchesTheServer() {
    let now = WireDate.timestamp("2026-07-17T22:30:00.000Z")!
    #expect(utcDaysUntil(WireDate.day("2026-07-17")!, from: now) == 0)
    #expect(utcDaysUntil(WireDate.day("2026-07-20")!, from: now) == 3)
    #expect(utcDaysUntil(WireDate.day("2026-07-16")!, from: now) == -1)
  }
}
