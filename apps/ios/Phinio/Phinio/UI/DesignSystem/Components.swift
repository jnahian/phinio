import SwiftUI
import UIKit

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

/// Circular avatar (toolbar 30pt, Profile 88pt): the profile photo when there
/// is one, otherwise initials on a flat color picked from `colorKey`.
struct AvatarView: View {
  let initials: String
  let size: CGFloat
  /// Stable per-profile key for the backdrop color — the profile id where the
  /// caller has one, so the color survives a rename.
  var colorKey: String = ""
  var photo: UIImage?

  var body: some View {
    Circle()
      .fill(AvatarPalette.color(for: colorKey.isEmpty ? initials : colorKey))
      .frame(width: size, height: size)
      .overlay {
        if let photo {
          Image(uiImage: photo)
            .resizable()
            .scaledToFill()
            .clipShape(.circle)
        } else {
          Text(initials)
            .font(.system(size: size * 0.35, weight: .bold))
            .foregroundStyle(.white)
        }
      }
      .accessibilityHidden(true)
  }
}

/// The deposit-history row shape, shared by every detail screen's history and
/// schedule section: tinted icon tile, title over an optional subtitle, and a
/// trailing amount over an optional caption. One component so the DPS schedule,
/// the amortization schedule, savings deposits and withdrawals all scan the
/// same way.
struct TransactionRow: View {
  let symbol: String
  let tint: Color
  let title: Text
  var subtitle: Text?
  let amount: Text
  var amountTint: Color = .primary
  var caption: Text?

  var body: some View {
    HStack(spacing: 12) {
      IconTile(size: 38, radius: 11, background: tint.opacity(0.14)) {
        Image(systemName: symbol)
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(tint)
          // Icons carry the row's state (paid / overdue / upcoming), so they
          // animate through it rather than cutting.
          .contentTransition(.symbolEffect(.replace))
      }
      VStack(alignment: .leading, spacing: 2) {
        title.font(.body).lineLimit(1)
        subtitle?.font(.caption).foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      VStack(alignment: .trailing, spacing: 2) {
        amount
          .font(.subheadline.weight(.semibold).monospacedDigit())
          .foregroundStyle(amountTint)
          .lineLimit(1).minimumScaleFactor(0.6)
        caption?
          .font(.caption2.monospacedDigit())
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
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
    Label {
      Text("Offline — changes sync when you reconnect.")
    } icon: {
      Image(systemName: "wifi.slash")
        .symbolEffect(.pulse, options: .repeating)
    }
      .font(.footnote)
      .foregroundStyle(.secondary)
      .padding(.horizontal, 14)
      .padding(.vertical, 8)
      .background(.regularMaterial, in: .capsule)
      .padding(.top, 4)
      .accessibilityElement(children: .combine)
  }
}
