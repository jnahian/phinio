import SwiftUI
import UIKit

// Phinio brand remnants on the native re-skin: the investment-type palette and
// the gradient hero cards. Everything else uses system semantic colors.

private extension UIColor {
  convenience init(hex: UInt32) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1)
  }
}

private extension Color {
  init(hex: UInt32) {
    self.init(uiColor: UIColor(hex: hex))
  }

  /// Adaptive brand color: `light` in light appearance, `dark` in dark.
  init(light: UInt32, dark: UInt32) {
    self.init(uiColor: UIColor { trait in
      trait.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
    })
  }
}

/// Drives investment-type badge bg/fg, donut slice, and legend swatch — one
/// source of truth so the three never disagree. Dark values are the Modern Noir
/// hues; light values are darkened same-hue variants for contrast on light
/// backgrounds. Background is foreground at 16% alpha.
enum TypePalette {
  static let stock = Color(light: 0x3D5AC8, dark: 0xB4C5FF)
  static let mutualFund = Color(light: 0x0E8F5F, dark: 0x4EDEA3)
  static let gold = Color(light: 0xA1720E, dark: 0xFFCF70)
  static let crypto = Color(light: 0x7C3AED, dark: 0xC79BFF)
  static let fd = Color(light: 0x0A7EA4, dark: 0x6FD0FF)
  /// Rose, not the comp's mint — mint collided with Mutual Fund on the
  /// allocation donut (see the Modern Noir spec, decision #6).
  static let dps = Color(light: 0xC2447E, dark: 0xFF9ECD)
  /// Light value is a deep navy, not a mid indigo like the dark one. Darkening
  /// both blues for light mode collapsed savings onto stock (CIELAB DeltaE 5.2 —
  /// perceptually identical), drawing two identical allocation slices. Navy
  /// restores the lightness separation (DeltaE 37.9 from stock, >=24 from all).
  static let savings = Color(light: 0x1B3B6D, dark: 0x7FA0FF)
  static let other = Color(light: 0x6B7280, dark: 0xC3C6D7)

  /// Maps `Investment.type` raw values (see Support/Formatting.swift) onto the
  /// 8 hues above. sanchayapatra (fixed-income) -> fd, real_estate/agro_farm
  /// (physical store-of-value) -> gold, business (equity-like) -> stock.
  static func foreground(for rawType: String) -> Color {
    switch rawType {
    case "stock", "business": stock
    case "mutual_fund": mutualFund
    case "gold", "real_estate", "agro_farm": gold
    case "crypto": crypto
    case "fd", "sanchayapatra": fd
    case "dps": dps
    case "savings": savings
    default: other
    }
  }

  static func background(for rawType: String) -> Color {
    foreground(for: rawType).opacity(0.16)
  }
}

/// Fixed dark gradients for the hero cards — the one deliberate non-standard
/// element; white content on top in both appearances.
enum Gradients {
  /// CSS `linear-gradient(Ndeg, …)` measures clockwise from "to top"; SwiftUI
  /// takes two UnitPoints. Converting the angle explicitly keeps every hero's
  /// falloff direction right regardless of its aspect ratio.
  private static func angled(_ degrees: Double, _ stops: [Gradient.Stop]) -> LinearGradient {
    let r = degrees * .pi / 180
    let dx = sin(r), dy = -cos(r)  // y grows downward in UnitPoint space
    return LinearGradient(
      stops: stops,
      startPoint: UnitPoint(x: 0.5 - dx / 2, y: 0.5 - dy / 2),
      endPoint: UnitPoint(x: 0.5 + dx / 2, y: 0.5 + dy / 2))
  }

  private static func angled(_ degrees: Double, _ colors: [Color]) -> LinearGradient {
    angled(
      degrees,
      colors.enumerated().map {
        .init(color: $1, location: Double($0) / Double(max(1, colors.count - 1)))
      })
  }

  static let netWorthHero = angled(140, [
    .init(color: Color(hex: 0x2563eb), location: 0),
    .init(color: Color(hex: 0x1c3aa0), location: 0.48),
    .init(color: Color(hex: 0x141d38), location: 1.0),
  ])
  static let emiLoanHero = angled(140, [Color(hex: 0x2563eb), Color(hex: 0x141d38)])
  static let emiCardHero = angled(140, [Color(hex: 0x7a4bd0), Color(hex: 0x20182f)])
  static let dpsHero = angled(140, [Color(hex: 0x00a572), Color(hex: 0x0d2a26)])
  static let savingsHero = angled(140, [Color(hex: 0x2563eb), Color(hex: 0x141d38)])
  static let avatar = angled(135, [Color(hex: 0x2563eb), Color(hex: 0x00a572)])
}
