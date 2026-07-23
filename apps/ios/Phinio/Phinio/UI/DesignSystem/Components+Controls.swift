import SwiftUI

// Empty state, avatar, icon tile — continuation of Components.swift (split
// at ~400 lines per the phase-1 brief). Same rules: tokens only, no inline
// hex/radius/shadow.

// MARK: - Empty state, avatar, icon tile

/// Circular gradient avatar with initials (top bar 42pt, Profile 88pt).
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

/// Rounded-square backdrop behind an SF Symbol (upcoming-payment icon 38pt
/// `surfaceHigh`, EMI-row icon 42pt `surfaceHighest`).
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
