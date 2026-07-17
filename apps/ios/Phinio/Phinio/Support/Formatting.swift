import Foundation

extension Decimal {
  /// Profile-currency display, always 2 fraction digits (BDT defaults to 2).
  func currency(_ code: String) -> String {
    formatted(.currency(code: code).precision(.fractionLength(2)))
  }
}

/// Display names for Investment.type raw values.
func investmentTypeLabel(_ raw: String) -> String {
  switch raw {
  case "stock": "Stocks"
  case "mutual_fund": "Mutual funds"
  case "fd": "Fixed deposit"
  case "gold": "Gold"
  case "crypto": "Crypto"
  case "sanchayapatra": "Sanchayapatra"
  case "real_estate": "Real estate"
  case "agro_farm": "Agro farm"
  case "business": "Business"
  case "dps": "DPS"
  case "savings": "Savings"
  default: "Other"
  }
}

/// UTC-day difference, mirroring dashboard.impl.ts (dueDate is @db.Date —
/// UTC midnight — so compare day-to-day, not wall-clock).
func utcDaysUntil(_ target: Date, from now: Date) -> Int {
  var cal = Calendar(identifier: .gregorian)
  cal.timeZone = TimeZone(identifier: "UTC")!
  let a = cal.startOfDay(for: now)
  let b = cal.startOfDay(for: target)
  return cal.dateComponents([.day], from: a, to: b).day ?? 0
}

func dueLabel(daysUntil d: Int) -> String {
  switch d {
  case ..<0: "Overdue"
  case 0: "Due today"
  case 1: "Due tomorrow"
  default: "In \(d) days"
  }
}
