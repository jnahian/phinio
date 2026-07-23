import SwiftUI

// Inputs, buttons, empty state, avatar, icon tile — continuation of
// Components.swift (split at ~400 lines per the phase-1 brief). Same rules:
// tokens only, no inline hex/radius/shadow.

// MARK: - Inputs & buttons

/// `surfaceLowest`-filled text field with a focus border and inline error.
struct CarvedTextField: View {
  let placeholder: String
  @Binding var text: String
  var errorText: String? = nil
  @FocusState private var focused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      TextField(placeholder, text: $text)
        .focused($focused)
        .font(.body)
        .foregroundStyle(Color.onSurface)
        .padding(13)
        .background(Color.surfaceLowest, in: RoundedRectangle(cornerRadius: Radii.input, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: Radii.input, style: .continuous)
            .strokeBorder(focused ? Color.brandPrimary : .clear, lineWidth: 1.5)
        )
      if let errorText {
        Text(errorText).font(.caption).foregroundStyle(Color.error)
      }
    }
  }
}

/// Full-width destructive action (Delete EMI / DPS scheme / savings pot).
struct DangerButton: View {
  let title: String
  let action: () -> Void

  init(_ title: String, action: @escaping () -> Void) {
    self.title = title
    self.action = action
  }

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(.rowLabel(15))
        .foregroundStyle(Color.error)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 15)
        .background(
          Color.tertiaryContainer.opacity(0.12),
          in: RoundedRectangle(cornerRadius: Radii.tile, style: .continuous))
    }
    .buttonStyle(.plain)
  }
}

/// Track/knob styling for `Toggle`. SwiftUI's `Toggle` already supplies tap
/// handling and accessibility (isOn value, switch semantics) regardless of the
/// custom style body — no gesture code needed here.
struct NoirToggleStyle: ToggleStyle {
  func makeBody(configuration: Configuration) -> some View {
    Button {
      configuration.isOn.toggle()
    } label: {
      ZStack(alignment: configuration.isOn ? .trailing : .leading) {
        Capsule()
          .fill(configuration.isOn ? Color.secondaryContainer : Color.surfaceHighest)
          .frame(width: 50, height: 30)
        Circle()
          .fill(Color.white)
          .frame(width: 24, height: 24)
          .padding(3)
      }
    }
    .buttonStyle(.plain)
    .frame(minWidth: 44, minHeight: 44)
    .contentShape(Rectangle())
    // A custom Button-based style doesn't inherit SwitchToggleStyle's on/off
    // accessibilityValue — call sites use .labelsHidden(), so state must be
    // announced here or VoiceOver reads a bare "Button".
    .accessibilityValue(configuration.isOn ? Text("On") : Text("Off"))
  }
}

extension ToggleStyle where Self == NoirToggleStyle {
  static var noir: NoirToggleStyle { NoirToggleStyle() }
}

// MARK: - Empty state, avatar, icon tile

/// Replaces `EmptyStateView`'s `ContentUnavailableView` — system chrome can't
/// take the design tokens. `UI/SharedViews.swift`'s `EmptyStateView` is left in
/// place until its call sites migrate in Phases 3-8.
struct NoirEmptyState: View {
  let title: String
  let message: String

  var body: some View {
    VStack(spacing: 8) {
      Text(title).font(.sectionTitle).foregroundStyle(Color.onSurface)
      Text(message).font(.body).foregroundStyle(Color.onSurfaceVariant)
    }
    .multilineTextAlignment(.center)
    .frame(maxWidth: .infinity)
    .padding(.vertical, 48)
    .padding(.horizontal, 24)
    .accessibilityElement(children: .combine)
  }
}

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
          .font(.avatarInitials(size * 0.35))
          .foregroundStyle(Color.avatarText)
      )
      .accessibilityHidden(true)
  }
}

/// Rounded-square backdrop behind an SF Symbol (upcoming-payment icon 38pt
/// `surfaceHigh`, EMI-row icon 42pt `surfaceHighest`).
struct IconTile<Icon: View>: View {
  let size: CGFloat
  let radius: CGFloat
  var background: Color = .surfaceHigh
  @ViewBuilder let icon: Icon

  var body: some View {
    icon
      .frame(width: size, height: size)
      .background(background, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
      .accessibilityHidden(true)
  }
}

// MARK: - Preview gallery

#Preview("Component Kit") {
  ScrollView {
    VStack(alignment: .leading, spacing: 20) {
      HeroCard(
        gradient: Gradients.netWorthHero, orbTint: Color.brandPrimary.opacity(0.18),
        orbSize: 220, orbTopOffset: -90
      ) {
        VStack(alignment: .leading, spacing: 8) {
          Text("NET WORTH")
            .font(.heroLabel).tracking(Tracking.heroLabel)
            .foregroundStyle(Color.onHeroVariant.opacity(0.72))
          Text("৳4,58,900")
            .font(.heroNumeric).tracking(Tracking.heroNumeric)
            .foregroundStyle(Color.onHeroVariant)
          MoneyPill(percent: 12.4, size: .hero)
        }
      }

      HStack(spacing: 12) {
        StatTile(label: "Current value", value: "৳3,10,000", alignment: .leading, valueFont: .amountLarge(19))
        StatTile(label: "Monthly EMI", value: "৳12,500", alignment: .leading, valueFont: .amountLarge(19))
      }

      NoirCard {
        VStack(alignment: .leading, spacing: 10) {
          SectionHeader(title: "Upcoming Payments", trailing: "Next 30 days")
          HStack {
            TypeBadge(type: "stock")
            MoneyPill(percent: -4.5)
          }
          NoirProgressBar(fraction: 0.6, tint: Color.brandSecondary).frame(height: 5)
        }
      }

      SectionGroup {
        NavRow(title: "Activity history")
        NavRow(title: "Change password", showsDivider: false)
      }

      FilterPills(titles: ["All", "Stocks", "Gold", "Crypto"], selection: .constant(1))
      SegmentedTabs(titles: ["Active", "Completed"], selection: .constant(0))

      SectionLabel("Preferences")

      CarvedTextField(placeholder: "Amount", text: .constant(""), errorText: "Required")

      DangerButton("Delete EMI") {}

      HStack {
        Text("Payment reminders").font(.body).foregroundStyle(Color.onSurface)
        Spacer()
        Toggle("Payment reminders", isOn: .constant(true))
          .toggleStyle(.noir)
          .labelsHidden()
      }

      NoirEmptyState(title: "Nothing here yet", message: "No investments match this filter.")

      HStack(spacing: 12) {
        AvatarView(initials: "RA", size: 42)
        IconTile(size: 38, radius: Radii.iconTile) {
          Image(systemName: "doc.text").foregroundStyle(Color.brandPrimary)
        }
        IconTile(size: 42, radius: Radii.segmentTrack, background: .surfaceHighest) {
          Image(systemName: "house").foregroundStyle(Color.brandPrimary)
        }
      }
    }
    .padding(20)
  }
  .background(Color.surface)
  .preferredColorScheme(.dark)
}
