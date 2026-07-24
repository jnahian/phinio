import SwiftUI

// Custom leaves that survive the native re-skin — pieces with no system
// equivalent: the gradient hero card, stat tiles, money/type badges, the
// gradient avatar, icon tiles, and the offline capsule.

/// Gradient hero (net worth, EMI/DPS/savings/lump-sum detail heroes) with a
/// blurred ambient orb. The one deliberate non-standard element: fixed dark
/// gradients, white content, both appearances.
struct HeroCard<Content: View>: View {
  let gradient: LinearGradient
  let orbTint: Color
  var radius: CGFloat = 22
  var orbSize: CGFloat = 200
  var orbTopOffset: CGFloat = -80
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
        // The orb bleeds outward past the trailing edge (+40 at a .topTrailing
        // anchor moves it outward).
        Circle()
          .fill(orbTint)
          .frame(width: orbSize, height: orbSize)
          .blur(radius: 46)
          .offset(x: 40, y: orbTopOffset)
      }
      .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
  }
}

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
        in: RoundedRectangle(cornerRadius: 8, style: .continuous))
  }
}

/// Circular gradient avatar with initials (toolbar 30pt, Profile 88pt).
struct AvatarView: View {
  let initials: String
  let size: CGFloat

  var body: some View {
    Circle()
      .fill(Gradients.avatar)
      .frame(width: size, height: size)
      .overlay(
        Text(initials)
          .font(.system(size: size * 0.35, weight: .bold))
          .foregroundStyle(.white)
      )
      .accessibilityHidden(true)
  }
}

/// Rounded-square backdrop behind an SF Symbol (list-row leading icons).
struct IconTile<Icon: View>: View {
  let size: CGFloat
  let radius: CGFloat
  var background: Color = Color(.tertiarySystemFill)
  @ViewBuilder let icon: Icon

  var body: some View {
    icon
      .frame(width: size, height: size)
      .background(background, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
      .accessibilityHidden(true)
  }
}

/// Connectivity capsule under the nav bar, on system material so it reads in
/// both appearances.
struct OfflineBanner: View {
  var body: some View {
    Label("Offline — changes sync when you reconnect.", systemImage: "wifi.slash")
      .font(.footnote)
      .foregroundStyle(.secondary)
      .padding(.horizontal, 14)
      .padding(.vertical, 8)
      .background(.regularMaterial, in: .capsule)
      .padding(.top, 4)
      .accessibilityElement(children: .combine)
  }
}
