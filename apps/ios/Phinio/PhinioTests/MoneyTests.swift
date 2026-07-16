import Foundation
import Testing
@testable import Phinio

struct MoneyTests {
  @Test func parsesAndFormatsTwoDecimals() {
    let d = Money.decimal("12345.60")
    #expect(d == Decimal(string: "12345.6"))
    #expect(Money.string(d!) == "12345.60")
    #expect(Money.string(Decimal(string: "100")!) == "100.00")
    #expect(Money.decimal("not money") == nil)
  }

  @Test func dayStringsRoundTripInUTC() {
    let date = WireDate.day("2026-01-31")
    #expect(date != nil)
    #expect(WireDate.dayString(date!) == "2026-01-31")
  }

  @Test func isoTimestampsParse() {
    let d = WireDate.iso.date(from: "2026-07-16T19:28:23.190Z")
    #expect(d != nil)
  }
}
