import SwiftUI

// Manrope/Inter Font helpers — exact values from the comp
// (docs/superpowers/specs/2026-07-23-phinio-ios-comp.dc.html).
// Two families, never mixed (brief §2: Manrope for numerics/headlines, Inter for
// body/UI text). PostScript names verified by the controller by dumping the
// font's name table — see Resources/Fonts/.

extension Font {
  // MARK: Manrope — numerics & headlines
  static let heroNumeric = Font.custom("Manrope-ExtraBold", size: 42)
  static let detailHeroNumeric = Font.custom("Manrope-ExtraBold", size: 40)
  static let screenTitle = Font.custom("Manrope-ExtraBold", size: 30)
  static let detailTitle = Font.custom("Manrope-ExtraBold", size: 22)
  static let displayName = Font.custom("Manrope-Bold", size: 20)
  static let sectionTitle = Font.custom("Manrope-Bold", size: 17)
  static let cardTitle = Font.custom("Manrope-Bold", size: 16)
  static let amount = Font.custom("Manrope-Bold", size: 15)
  /// Comp uses this at two concrete sizes: 20 for list-row/detail-row numerics,
  /// 22 for dashboard summary-card figures. Pass the size that matches context.
  static func amountLarge(_ size: CGFloat) -> Font { .custom("Manrope-Bold", size: size) }
  static let amountSecondary = Font.custom("Manrope-SemiBold", size: 15)
  /// Comp uses 11 or 12 depending on pill placement (list row vs. detail hero).
  static func pillText(_ size: CGFloat) -> Font { .custom("Manrope-Bold", size: size) }
  static let tableRow = Font.custom("Manrope-SemiBold", size: 10.5)

  // MARK: Inter — body & UI chrome
  /// Comp uses 14 for most list rows, 15 for destructive row labels (e.g. Sign out).
  static func rowLabel(_ size: CGFloat) -> Font { .custom("Inter-SemiBold", size: size) }
  static let body = Font.custom("Inter-Medium", size: 13)
  static let caption = Font.custom("Inter-Medium", size: 12)
  static let meta = Font.custom("Inter-Medium", size: 11)
  static let sectionLabel = Font.custom("Inter-SemiBold", size: 12)  // uppercase, tracking 0.1em
  static let heroLabel = Font.custom("Inter-SemiBold", size: 12)  // uppercase, tracking 0.14em
  static let tabLabel = Font.custom("Inter-SemiBold", size: 10)
}

/// SwiftUI's `.tracking(_:)` view modifier takes points, not em; these are the
/// brief's em values pre-multiplied by their paired font's size. Apply via
/// `.font(.heroNumeric).tracking(Tracking.heroNumeric)`.
enum Tracking {
  static let heroNumeric: CGFloat = -0.02 * 42
  static let detailHeroNumeric: CGFloat = -0.02 * 40
  static let screenTitle: CGFloat = -0.02 * 30
  static let sectionLabel: CGFloat = 0.1 * 12
  static let heroLabel: CGFloat = 0.14 * 12
}
