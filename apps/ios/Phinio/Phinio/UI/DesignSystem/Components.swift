import SwiftUI

// Shared Modern Noir component kit — every screen (Phases 2-8) composes out of
// these. Tokens only, no inline hex/radius/shadow (docs/superpowers/specs/
// 2026-07-23-phinio-ios-comp.dc.html is the pixel source of truth).

// MARK: - Surfaces

/// Grouped row list container — `surfaceLow`, radius 16. Rows bring their own
/// padding/hairlines; this just clips them to the card shape.
struct SectionGroup<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    VStack(spacing: 0) { content }
      .background(Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
      .clipShape(RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
  }
}

/// Gradient hero (net worth, EMI/DPS/savings detail heroes). Orb size/offset
/// vary per hero in the comp (200-220pt, top -80/-90) — only the constant blur
/// radius and trailing offset are tokenized (`AmbientOrb`), the rest are params.
struct HeroCard<Content: View>: View {
  let gradient: LinearGradient
  let orbTint: Color
  var radius: CGFloat = Radii.hero
  var orbSize: CGFloat = 200
  var orbTopOffset: CGFloat = -80
  // Comp padding is uniform 22 on every hero except net-worth (22 22 24) —
  // default keeps the common case a single value, net-worth passes 24.
  var bottomPadding: CGFloat = 22
  @ViewBuilder let content: Content

  var body: some View {
    content
      .padding(.horizontal, 22)
      .padding(.top, 22)
      .padding(.bottom, bottomPadding)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(gradient)
      .background(alignment: .topTrailing) {
        // Comp's `right:-40px` bleeds the orb *outward* past the card's
        // trailing edge; `.offset` at a `.topTrailing` anchor moves inward on
        // positive x, so the token's sign is negated here to match.
        Circle()
          .fill(orbTint)
          .frame(width: orbSize, height: orbSize)
          .blur(radius: AmbientOrb.blurRadius)
          .offset(x: -AmbientOrb.trailingOffset, y: orbTopOffset)
      }
      .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
      .shadow(
        color: Shadows.hero.color, radius: Shadows.hero.radius, x: Shadows.hero.x, y: Shadows.hero.y)
  }
}

// MARK: - Stats & badges

/// Grid tile (3-up on EMI/DPS detail, 2-up on Savings detail).
struct StatTile: View {
  let label: String
  let value: String
  var alignment: HorizontalAlignment = .center

  var body: some View {
    VStack(alignment: alignment, spacing: 4) {
      Text(label).font(.caption).foregroundStyle(.secondary)
      Text(value)
        .font(.headline.monospacedDigit())
        .lineLimit(1)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    .padding(.vertical, 12)
    .padding(.horizontal, 10)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

/// Gain/loss capsule. `.compact` for list rows and stat cards, `.hero` for
/// placement on gradient hero cards (white on translucent white).
struct MoneyPill: View {
  enum Size { case compact, hero }

  let percent: Decimal
  var size: Size = .compact

  private var isPositive: Bool { percent >= 0 }

  private var valueText: String {
    percent.formatted(.number.sign(strategy: .always()).precision(.fractionLength(1))) + "%"
  }

  var body: some View {
    Text("\(isPositive ? "▲" : "▼") \(valueText)")
      .font(.caption.weight(.bold).monospacedDigit())
      .foregroundStyle(size == .hero ? Color.white : (isPositive ? Color.green : Color.red))
      .padding(.horizontal, 9)
      .padding(.vertical, size == .hero ? 4 : 3)
      .background(
        size == .hero
          ? AnyShapeStyle(.white.opacity(0.18))
          : AnyShapeStyle((isPositive ? Color.green : Color.red).opacity(0.15)),
        in: .capsule)
      .accessibilityLabel(
        Text(
          "\(isPositive ? "Up" : "Down") \(percent.magnitude.formatted(.number.precision(.fractionLength(1))))%"
        ))
  }
}

/// Investment-type chip — colors from `TypePalette`, so it never disagrees
/// with the allocation donut/legend.
struct TypeBadge: View {
  let type: String  // Investment.type raw value

  var body: some View {
    Text(investmentTypeLabel(type))
      .font(.caption2.weight(.semibold))
      .foregroundStyle(TypePalette.foreground(for: type))
      .padding(.horizontal, 9)
      .padding(.vertical, 3)
      .background(
        TypePalette.background(for: type),
        in: RoundedRectangle(cornerRadius: Radii.badge, style: .continuous))
  }
}
