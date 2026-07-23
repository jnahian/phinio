import SwiftUI
import UIKit

// Modern Noir design tokens — exact values from the comp
// (docs/superpowers/specs/2026-07-23-phinio-ios-comp.dc.html).
// Phase 0 only defines vocabulary; screens are restyled in Phases 3-8.

private extension Color {
  init(hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255)
  }
}

extension Color {
  // MARK: Surfaces
  static let surface = Color(hex: 0x0b1326)
  static let surfaceLowest = Color(hex: 0x060e20)  // inputs, progress track, segmented control bg
  static let surfaceLow = Color(hex: 0x131b2e)  // section group
  static let surfaceHigh = Color(hex: 0x222a3d)  // card body
  static let surfaceHighest = Color(hex: 0x2d3449)  // icon tile, active segment
  // Comp-only — not in docs/IOS_DESIGN_BRIEF.md's palette table.
  static let pillIdle = Color(hex: 0x1c2438)

  // MARK: Text
  static let onSurface = Color(hex: 0xdae2fd)
  static let onSurfaceVariant = Color(hex: 0xc3c6d7)
  // Comp-only — not in docs/IOS_DESIGN_BRIEF.md's palette table.
  static let onSurfaceMuted = Color(hex: 0x8a92a8)  // metadata, dates
  // Comp-only — not in docs/IOS_DESIGN_BRIEF.md's palette table.
  static let onSurfaceFaint = Color(hex: 0x6b7288)  // table headers, paid rows
  // Comp-only — not in docs/IOS_DESIGN_BRIEF.md's palette table.
  static let tabIdle = Color(hex: 0x5a6178)  // idle tab label, chevrons
  // Brief lists "onHero #ffffff / #f2f5ff" as one entry. The comp uses #fff for
  // detailHeroNumeric (EMI/DPS/Savings heroes) and #f2f5ff only for the net-worth
  // hero numeric — split into two tokens, named on the onSurface/onSurfaceVariant pattern.
  static let onHero = Color(hex: 0xffffff)
  static let onHeroVariant = Color(hex: 0xf2f5ff)
  static let avatarText = Color(hex: 0xeaf0ff)

  // MARK: Accent / semantic
  // Named `brandPrimary`/`brandSecondary`, not `primary`/`secondary` — those
  // names shadow SwiftUI's own `Color.primary`/`.secondary` (and
  // `ShapeStyle.primary`/`.secondary`). In a generic ShapeStyle context —
  // which is how `.foregroundStyle(...)`, `.tint(...)`, `.background(...)`
  // resolve implicit-member syntax like `.primary` — the bare shorthand binds
  // to SwiftUI's HierarchicalShapeStyle, not this color, and silently falls
  // back to system gray while still compiling and building green.
  static let brandPrimary = Color(hex: 0xb4c5ff)
  static let primaryContainer = Color(hex: 0x2563eb)
  static let brandSecondary = Color(hex: 0x4edea3)
  // Hero-placed gain pill text color (net-worth hero, savings-detail hero) —
  // comp uses this brighter shade instead of brandSecondary at hero scale.
  static let brandSecondaryHero = Color(hex: 0x7ff0c4)
  static let secondaryContainer = Color(hex: 0x00a572)
  static let tertiaryContainer = Color(hex: 0xcf2c30)
  static let tertiaryFixedDim = Color(hex: 0xffb3ad)
  static let error = Color(hex: 0xffb4ab)
  static let outlineVariant = Color(hex: 0x434655)
}

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
  /// Adaptive brand color: `light` in light appearance, `dark` in dark.
  init(light: UInt32, dark: UInt32) {
    self.init(uiColor: UIColor { trait in
      trait.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
    })
  }
}

/// Drives investment-type badge bg/fg, donut slice, and legend swatch — one source
/// of truth so the three never disagree (comp badge map, not the legend, wins per
/// decision #6 in _shared-constraints.md). Background is foreground at 16% alpha.
enum TypePalette {
  static let stock = Color(light: 0x3D5AC8, dark: 0xB4C5FF)
  static let mutualFund = Color(light: 0x0E8F5F, dark: 0x4EDEA3)
  static let gold = Color(light: 0xA1720E, dark: 0xFFCF70)
  static let crypto = Color(light: 0x7C3AED, dark: 0xC79BFF)
  static let fd = Color(light: 0x0A7EA4, dark: 0x6FD0FF)
  /// NOT from the comp. The comp's badge map gives DPS the same #4edea3 as
  /// Mutual Fund, which is survivable on a badge (the label differs) but makes
  /// two allocation-donut slices identical. The comp's own legend works around
  /// it with #6fd0ff — already FD's hue — so no comp value resolves this.
  /// Rose sits in the one hue family the palette leaves free: far from mint
  /// (158°), cyan (197°) and violet (270°), and distinct from the salmon
  /// error/overdue tints (~4°), which never share a surface with a type swatch.
  /// This supersedes the brief §5.7 "green DPS badge" — the badge follows the
  /// palette so badge, slice and legend can never disagree (decision #6).
  static let dps = Color(light: 0xC2447E, dark: 0xFF9ECD)
  static let savings = Color(light: 0x3554C9, dark: 0x7FA0FF)
  static let other = Color(light: 0x6B7280, dark: 0xC3C6D7)

  /// Maps `Investment.type` raw values (see Support/Formatting.swift) onto the
  /// 8 hues above. The comp never drew swatches for sanchayapatra/real_estate/
  /// agro_farm/business, so these piggyback on the closest existing hue rather
  /// than inventing new colors: sanchayapatra (fixed-income) -> fd,
  /// real_estate/agro_farm (physical store-of-value) -> gold, business (equity-like) -> stock.
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

enum Gradients {
  /// CSS `linear-gradient(Ndeg, …)` measures clockwise from "to top"; SwiftUI
  /// takes two UnitPoints. `.topLeading -> .bottomTrailing` is NOT the comp's
  /// 140° — it is whatever the box's own diagonal happens to be, so on a wide
  /// short card (the net-worth hero is ~350x150) it lands near 110° and the
  /// dark end gets squeezed into one corner instead of falling off downward.
  /// Converting the angle explicitly keeps every hero's falloff direction right
  /// regardless of its aspect ratio.
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
  static let summaryCard = angled(140, [Color(hex: 0x222a3d), Color(hex: 0x1a2236)])
  static let emiLoanHero = angled(140, [Color(hex: 0x2563eb), Color(hex: 0x141d38)])
  static let emiCardHero = angled(140, [Color(hex: 0x7a4bd0), Color(hex: 0x20182f)])
  static let dpsHero = angled(140, [Color(hex: 0x00a572), Color(hex: 0x0d2a26)])
  static let savingsHero = angled(140, [Color(hex: 0x2563eb), Color(hex: 0x141d38)])
  static let avatar = angled(135, [Color(hex: 0x2563eb), Color(hex: 0x00a572)])
}

enum Radii {
  static let hero: CGFloat = 22
  static let detailHero: CGFloat = 20
  static let summary: CGFloat = 18
  static let card: CGFloat = 16
  static let tile: CGFloat = 14
  static let currencyTile: CGFloat = 13
  static let input: CGFloat = 11
  static let iconTile: CGFloat = 11
  // Comp's segmented-tabs track (Investments "Status tabs") and the 42pt EMI
  // icon tile both use this value — missing from Phase 0, added here.
  static let segmentTrack: CGFloat = 12
  static let segment: CGFloat = 9
  static let badge: CGFloat = 8
  static let tabPill: CGFloat = 32
  // pill/circle shapes use SwiftUI's Capsule()/Circle() directly, not a corner radius.
}

struct ShadowToken {
  let color: Color
  let radius: CGFloat
  let x: CGFloat
  let y: CGFloat
}

enum Shadows {
  // Only `card` specifies a shadow color in the comp (#040a1a); the others reuse
  // it for consistency since no alternate color is drawn. Comp "blur" is passed
  // straight through as SwiftUI's shadow `radius` (no CSS blur/radius conversion).
  static let card = ShadowToken(color: Color(hex: 0x040a1a).opacity(0.28), radius: 30, x: 0, y: 10)
  // Comp gives hero as a range (y16-18, blur40-44); midpoint used.
  static let hero = ShadowToken(color: Color(hex: 0x040a1a).opacity(0.50), radius: 42, x: 0, y: 17)
  static let tabBar = ShadowToken(color: Color(hex: 0x040a1a).opacity(0.50), radius: 30, x: 0, y: -2)
  static let fabItem = ShadowToken(color: Color(hex: 0x040a1a).opacity(0.55), radius: 22, x: 0, y: 8)
}

/// Tab bar + FAB only, per the comp.
enum Glass {
  static let fill = Color(hex: 0x131b2e).opacity(0.82)
  static let backdrop: Material = .regularMaterial
  // Comp gives a range (8-10%); midpoint used.
  static let border = Color.brandPrimary.opacity(0.09)
}

/// Blurred ambient circle behind every hero. Size (200-220pt) and top offset
/// (-80/-90) vary per hero in the comp; only the constant parts are tokenized here.
/// Tint color/opacity also vary per hero and are composed from existing tokens
/// (e.g. `Color.brandPrimary.opacity(0.18)`) at the call site — Phase 3+.
enum AmbientOrb {
  static let blurRadius: CGFloat = 46
  static let trailingOffset: CGFloat = -40
}

enum Layout {
  static let screenHorizontalPadding: CGFloat = 20
  static let contentTopInset: CGFloat = 54
  static let contentBottomInset: CGFloat = 104
  static let cardGap: CGFloat = 12
  static let sectionGap: CGFloat = 22
}
