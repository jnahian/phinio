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
///
/// Every hue is pinned by two measured constraints, both asserted in
/// `TypePaletteTests`: pairwise CIELAB DeltaE >= 24 (below that two allocation
/// slices read as one color) and >= 4.5:1 contrast on its own appearance's
/// grouped background (`TypeBadge` draws these as caption-size text). The
/// earlier pastel set traded chroma for headroom and read as washed out on the
/// donut; these are the most saturated variants that still clear both bars.
enum TypePalette {
  /// The (light, dark) table is the single source of truth: `color` builds the
  /// SwiftUI value and `TypePaletteTests` runs its DeltaE/contrast assertions
  /// straight off the same numbers, so the two can't drift apart.
  enum Hue: CaseIterable {
    case stock, mutualFund, gold, crypto, fd, dps, savings, other

    var hex: (light: UInt32, dark: UInt32) {
      switch self {
      case .stock: (0x3B5BDB, 0x98B0FF)
      case .mutualFund: (0x00875E, 0x2FE3A0)
      case .gold: (0x936300, 0xFFC233)
      case .crypto: (0x8B2FE8, 0xB57CFF)
      case .fd: (0x00789F, 0x2ED2FF)
      // Rose, not the comp's mint — mint collided with Mutual Fund on the
      // allocation donut (see the Modern Noir spec, decision #6).
      case .dps: (0xD01F63, 0xFF6FA8)
      // Light value is a deep navy, not a mid indigo like the dark one.
      // Darkening both blues for light mode collapsed savings onto stock
      // (DeltaE 5.2 — perceptually identical), drawing two identical
      // allocation slices. Navy restores the lightness separation.
      case .savings: (0x14286B, 0x6280F0)
      case .other: (0x6B7280, 0xA8ADC4)
      }
    }

    var color: Color { Color(light: hex.light, dark: hex.dark) }
  }

  /// EMI detail/list draw the interest slice in this hue directly.
  static let crypto = Hue.crypto.color

  /// Maps `Investment.type` raw values (see Support/Formatting.swift) onto the
  /// 8 hues above. sanchayapatra (fixed-income) -> fd, real_estate/agro_farm
  /// (physical store-of-value) -> gold, business (equity-like) -> stock.
  static func foreground(for rawType: String) -> Color {
    hue(for: rawType).color
  }

  static func hue(for rawType: String) -> Hue {
    switch rawType {
    case "stock", "business": .stock
    case "mutual_fund": .mutualFund
    case "gold", "real_estate", "agro_farm": .gold
    case "crypto": .crypto
    case "fd", "sanchayapatra": .fd
    case "dps": .dps
    case "savings": .savings
    default: .other
    }
  }

  static func background(for rawType: String) -> Color {
    foreground(for: rawType).opacity(0.16)
  }
}

/// Flat avatar backdrops, one picked per profile. Every entry clears 4.5:1
/// against the white initials it sits under, in both appearances (these are
/// fixed, not adaptive — the avatar is always white-on-color).
enum AvatarPalette {
  static let colors: [Color] = [
    Color(hex: 0x2563EB), Color(hex: 0x047857), Color(hex: 0xB45309),
    Color(hex: 0x7C3AED), Color(hex: 0x0E7490), Color(hex: 0xDB2777),
    Color(hex: 0xC2410C), Color(hex: 0x4F46E5),
  ]

  /// Deterministic from a stable key (profile id, falling back to the name), so
  /// the color is assigned once and never re-rolls between redraws.
  /// `String.hashValue` is seeded per process and would pick a new color on
  /// every launch — hash the bytes ourselves instead.
  static func color(for key: String) -> Color {
    var hash: UInt64 = 0xCBF2_9CE4_8422_2325  // FNV-1a
    for byte in key.utf8 {
      hash = (hash ^ UInt64(byte)) &* 0x0000_0100_0000_01B3
    }
    return colors[Int(hash % UInt64(colors.count))]
  }
}

/// The net-worth hero's brightest blue — the top stop of `Gradients.netWorthHero`.
/// Tints the auth screen's primary button and links so login echoes the home hero.
enum Brand {
  static let blue = Color(hex: 0x2563eb)
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
}
