import SwiftUI

// Shared Modern Noir component kit — every screen (Phases 2-8) composes out of
// these. Tokens only, no inline hex/radius/shadow (docs/superpowers/specs/
// 2026-07-23-phinio-ios-comp.dc.html is the pixel source of truth).

// MARK: - Surfaces

/// Elevated card — `surfaceHigh`, radius 16, card shadow, 16pt padding.
struct NoirCard<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    content
      .padding(16)
      .background(Color.surfaceHigh, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
      .shadow(
        color: Shadows.card.color, radius: Shadows.card.radius, x: Shadows.card.x, y: Shadows.card.y)
  }
}

/// Grouped row list container — `surfaceLow`, radius 16. Rows bring their own
/// padding/hairlines (see `NavRow`); this just clips them to the card shape.
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

/// Grid tile (3-up centered on EMI/DPS detail, 2-up leading on Savings detail).
struct StatTile: View {
  let label: String
  let value: String
  var alignment: HorizontalAlignment = .center
  var valueFont: Font = .cardTitle

  var body: some View {
    VStack(alignment: alignment, spacing: 6) {
      Text(label).font(.meta).foregroundStyle(Color.onSurfaceVariant)
      Text(value).font(valueFont).foregroundStyle(Color.onSurface)
    }
    .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    .padding(.vertical, 13)
    .padding(.horizontal, 12)
    .background(Color.surfaceHigh, in: RoundedRectangle(cornerRadius: Radii.tile, style: .continuous))
  }
}

/// Gain/loss capsule. `.compact` for list rows and quick stats, `.hero` for
/// detail-hero placement (larger opacity/padding per the comp).
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
      .font(.pillText(12))
      .foregroundStyle(
        isPositive
          ? (size == .hero ? Color.brandSecondaryHero : Color.brandSecondary)
          : Color.tertiaryFixedDim
      )
      .padding(.horizontal, 9)
      .padding(.vertical, size == .hero ? 4 : 3)
      .background(
        isPositive
          ? Color.brandSecondary.opacity(size == .hero ? 0.20 : 0.14)
          : Color.tertiaryContainer.opacity(0.18),
        in: Capsule()
      )
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
      .font(.badgeLabel)
      .foregroundStyle(TypePalette.foreground(for: type))
      .padding(.horizontal, 9)
      .padding(.vertical, 3)
      .background(
        TypePalette.background(for: type),
        in: RoundedRectangle(cornerRadius: Radii.badge, style: .continuous))
  }
}

// MARK: - Filters & tabs

/// Horizontal scrolling filter chips, bleeding to the screen edge (comp:
/// `margin:0 -20px;padding:0 20px`).
struct FilterPills: View {
  let titles: [String]
  @Binding var selection: Int

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        ForEach(titles.indices, id: \.self) { i in
          let isSelected = i == selection
          Button {
            selection = i
          } label: {
            Text(titles[i])
              .font(.rowLabel(13))
              .foregroundStyle(isSelected ? Color.surface : Color.onSurfaceVariant)
              .padding(.horizontal, 15)
              .padding(.vertical, 8)
              .background(isSelected ? Color.brandPrimary : Color.pillIdle, in: Capsule())
              // Drawn chip keeps comp size; frame only expands the tap target
              // to >=44pt (same pattern as NoirToggleStyle/NavRow).
              .frame(minWidth: 44, minHeight: 44)
              .contentShape(Rectangle())
          }
          .buttonStyle(.plain)
          .accessibilityAddTraits(isSelected ? .isSelected : [])
        }
      }
      .padding(.horizontal, Layout.screenHorizontalPadding)
    }
    .padding(.horizontal, -Layout.screenHorizontalPadding)
  }
}

/// Two/three-way segmented control (Active / Completed). `surfaceLowest`
/// track, active segment `surfaceHighest`.
struct SegmentedTabs: View {
  let titles: [String]
  @Binding var selection: Int

  var body: some View {
    HStack(spacing: 6) {
      ForEach(titles.indices, id: \.self) { i in
        let isSelected = i == selection
        Text(titles[i])
          .font(.rowLabel(14))
          .foregroundStyle(isSelected ? Color.onSurface : Color.onSurfaceMuted)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 9)
          .background(
            isSelected ? Color.surfaceHighest : .clear,
            in: RoundedRectangle(cornerRadius: Radii.segment, style: .continuous))
          // The comp's track is ~43pt tall — a `.frame(minHeight: 44)` on the
          // segment itself would grow the *shared* HStack row (and with it
          // the surfaceLowest track all segments sit in), not just this one.
          // `.overlay` is size-neutral for the parent's layout (the base
          // Text's size, not the overlay's, is what's reported to the
          // HStack), so a real 44pt Button dropped in via overlay grows only
          // the tappable area — the drawn segment/track stay comp-sized.
          .accessibilityHidden(true)  // the overlay Button below carries the accessible label/state
          .overlay {
            Button {
              selection = i
            } label: {
              Color.clear
            }
            .buttonStyle(.plain)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
            .accessibilityLabel(titles[i])
            .accessibilityAddTraits(isSelected ? .isSelected : [])
          }
      }
    }
    .padding(4)
    .background(Color.surfaceLowest, in: RoundedRectangle(cornerRadius: Radii.segmentTrack, style: .continuous))
  }
}

/// Thin capsule progress bar (DPS/EMI list rows). Track `surfaceLowest`, 5pt tall.
struct NoirProgressBar: View {
  let fraction: Double
  let tint: Color

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.surfaceLowest)
        Capsule().fill(tint)
          .frame(width: geo.size.width * min(max(fraction, 0), 1))
      }
    }
    .frame(height: 5)
  }
}

// MARK: - Section chrome

/// Screen section title with an optional trailing caption (e.g. "Next 30 days").
struct SectionHeader: View {
  let title: String
  var trailing: String? = nil

  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(title).font(.sectionTitle).foregroundStyle(Color.onSurface)
      Spacer()
      if let trailing {
        Text(trailing).font(.caption).foregroundStyle(Color.brandPrimary)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(.isHeader)
  }
}

/// Uppercase group label (Preferences / Account / Developer tools).
struct SectionLabel: View {
  let text: String
  init(_ text: String) { self.text = text }

  var body: some View {
    Text(text)
      .font(.sectionLabel)
      .tracking(Tracking.sectionLabel)
      .textCase(.uppercase)
      .foregroundStyle(Color.onSurfaceMuted)
      .accessibilityAddTraits(.isHeader)
  }
}

/// Chevron row for grouped lists (Profile). Purely presentational — wrap in a
/// `NavigationLink`/`Button` at the call site for the tap action, matching the
/// existing `UpcomingRow` pattern in SharedViews.swift.
struct NavRow: View {
  let title: String
  var showsDivider: Bool = true

  var body: some View {
    VStack(spacing: 0) {
      HStack {
        Text(title).font(.navRowLabel).foregroundStyle(Color.onSurface)
        Spacer()
        Image(systemName: "chevron.right")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color.tabIdle)
          .accessibilityHidden(true)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 15)
      .frame(minHeight: 44)
      if showsDivider {
        Rectangle()
          .fill(Color.outlineVariant.opacity(0.5))
          .frame(height: 0.5)
          .padding(.leading, 16)
      }
    }
    .contentShape(Rectangle())
    .accessibilityElement(children: .combine)
  }
}
