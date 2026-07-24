import SwiftUI
import Testing
import UIKit

@testable import Phinio

/// The investment-type hues are tuned by eye but bounded by two measurable
/// constraints. Retuning them for "more pop" is exactly the change that
/// silently breaks either one, so both are asserted here rather than left in a
/// comment.
struct TypePaletteTests {
  /// CIELAB L*a*b* for an sRGB hex, D65 white point.
  private static func lab(_ hex: UInt32) -> (Double, Double, Double) {
    func linear(_ c: Double) -> Double {
      c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }
    let r = linear(Double((hex >> 16) & 0xFF) / 255)
    let g = linear(Double((hex >> 8) & 0xFF) / 255)
    let b = linear(Double(hex & 0xFF) / 255)
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    let y = r * 0.2126 + g * 0.7152 + b * 0.0722
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    func f(_ t: Double) -> Double {
      t > 216.0 / 24389.0 ? pow(t, 1.0 / 3.0) : (841.0 / 108.0) * t + 4.0 / 29.0
    }
    let (fx, fy, fz) = (f(x), f(y), f(z))
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
  }

  private static func deltaE(_ a: UInt32, _ b: UInt32) -> Double {
    let (l1, a1, b1) = lab(a), (l2, a2, b2) = lab(b)
    return ((l1 - l2) * (l1 - l2) + (a1 - a2) * (a1 - a2) + (b1 - b2) * (b1 - b2))
      .squareRoot()
  }

  private static func relativeLuminance(_ hex: UInt32) -> Double {
    func linear(_ c: Double) -> Double {
      c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * linear(Double((hex >> 16) & 0xFF) / 255)
      + 0.7152 * linear(Double((hex >> 8) & 0xFF) / 255)
      + 0.0722 * linear(Double(hex & 0xFF) / 255)
  }

  private static func contrast(_ a: UInt32, _ b: UInt32) -> Double {
    let (lo, hi) = (
      min(relativeLuminance(a), relativeLuminance(b)),
      max(relativeLuminance(a), relativeLuminance(b))
    )
    return (hi + 0.05) / (lo + 0.05)
  }

  /// Below ~24 two allocation slices read as the same color, which is what the
  /// donut and its legend exist to distinguish.
  @Test func hueSeparation() {
    let hues = TypePalette.Hue.allCases
    for (i, first) in hues.enumerated() {
      for second in hues[(i + 1)...] {
        let dark = Self.deltaE(first.hex.dark, second.hex.dark)
        let light = Self.deltaE(first.hex.light, second.hex.light)
        #expect(dark >= 24, "\(first) vs \(second) dark DeltaE \(dark)")
        #expect(light >= 24, "\(first) vs \(second) light DeltaE \(light)")
      }
    }
  }

  /// `TypeBadge` draws these as caption-size text on the grouped background of
  /// their own appearance, so each has to clear WCAG AA for small text.
  @Test func textContrast() {
    let darkSurface: UInt32 = 0x1C1C1E  // secondarySystemGroupedBackground, dark
    let lightSurface: UInt32 = 0xFFFFFF
    for hue in TypePalette.Hue.allCases {
      let dark = Self.contrast(hue.hex.dark, darkSurface)
      let light = Self.contrast(hue.hex.light, lightSurface)
      #expect(dark >= 4.5, "\(hue) dark contrast \(dark)")
      #expect(light >= 4.5, "\(hue) light contrast \(light)")
    }
  }

  /// White initials sit on top of every avatar backdrop.
  @Test func avatarColorsCarryWhiteText() {
    for color in AvatarPalette.colors {
      let components = UIColor(color).cgColor.components ?? []
      #expect(components.count >= 3)
      let hex = UInt32(components[0] * 255) << 16
        | UInt32(components[1] * 255) << 8
        | UInt32(components[2] * 255)
      #expect(Self.contrast(hex, 0xFFFFFF) >= 4.5, "avatar color \(hex) vs white")
    }
  }

  /// The color has to survive relaunches — `String.hashValue` is seeded per
  /// process and would re-roll it, so the picker hashes bytes itself. Nothing
  /// here can catch a per-process seed within one run, so pin the mapping to a
  /// literal instead: if the hash changes, every existing avatar changes color.
  @Test func avatarColorIsStableForAKey() {
    #expect(AvatarPalette.color(for: "profile-123") == AvatarPalette.colors[7])
    #expect(AvatarPalette.color(for: "") == AvatarPalette.colors[5])
    // Distinct keys should actually spread, not collapse onto one entry.
    let spread = Set((0..<40).map { index in
      AvatarPalette.color(for: "profile-\(index)").description
    })
    #expect(spread.count >= 6)
  }
}
