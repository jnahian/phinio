import Foundation

/// Wire-format helpers. Money travels as 2-decimal strings (never JSON
/// numbers) and is held as Decimal in models — mirrors the server's
/// Decimal(15,2) rule.
enum Money {
  private static let posix = Locale(identifier: "en_US_POSIX")

  static func decimal(_ s: String) -> Decimal? {
    guard s.range(of: #"^\d+(\.\d{1,2})?$"#, options: .regularExpression) != nil
    else { return nil }
    return Decimal(string: s, locale: posix)
  }

  static func string(_ d: Decimal) -> String {
    let cents = ((d * 100) as NSDecimalNumber)
      .rounding(accordingToBehavior: NSDecimalNumberHandler(
        roundingMode: .plain, scale: 0, raiseOnExactness: false,
        raiseOnOverflow: false, raiseOnUnderflow: false,
        raiseOnDivideByZero: false))
      .intValue
    return String(format: "%d.%02d", cents / 100, abs(cents % 100))
  }
}

enum WireDate {
  static let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()

  private static let isoNoFraction: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
  }()

  private static let dayFormatter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd"
    return f
  }()

  static func day(_ s: String) -> Date? { dayFormatter.date(from: s) }
  static func dayString(_ d: Date) -> String { dayFormatter.string(from: d) }

  /// Timestamps arrive with or without fractional seconds depending on the
  /// column — accept both.
  static func timestamp(_ s: String) -> Date? {
    iso.date(from: s) ?? isoNoFraction.date(from: s)
  }
}
