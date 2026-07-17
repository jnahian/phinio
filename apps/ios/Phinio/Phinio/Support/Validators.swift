import Foundation

/// Client-side mirror of src/lib/validators.ts primitives. The server
/// re-validates everything; these exist so forms reject bad input before it
/// reaches the outbox (a 4xx there lands in the sync-issues list instead).
enum Validate {
  /// zod money regex: ^\d+(\.\d{1,2})?$ on the trimmed string.
  static func money(_ s: String) -> Decimal? {
    let t = s.trimmingCharacters(in: .whitespaces)
    guard t.wholeMatch(of: /\d+(\.\d{1,2})?/) != nil else { return nil }
    return Money.decimal(t)
  }

  static func positiveMoney(_ s: String) -> Decimal? {
    guard let d = money(s), d > 0 else { return nil }
    return d
  }

  static func nonNegativeMoney(_ s: String) -> Decimal? {
    guard let d = money(s), d >= 0 else { return nil }
    return d
  }

  /// Rate: money regex, 0 <= r < 100.
  static func rate(_ s: String) -> Decimal? {
    guard let d = money(s), d >= 0, d < 100 else { return nil }
    return d
  }

  static func name(_ s: String, max: Int = 120) -> String? {
    let t = s.trimmingCharacters(in: .whitespaces)
    guard !t.isEmpty, t.count <= max else { return nil }
    return t
  }

  /// nil = invalid (too long); .some(nil) = empty (omit from wire body).
  static func notes(_ s: String, max: Int = 1000) -> String?? {
    let t = s.trimmingCharacters(in: .whitespaces)
    if t.isEmpty { return .some(nil) }
    guard t.count <= max else { return nil }
    return t
  }
}
