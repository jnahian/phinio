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
  var secure: Bool = false
  @FocusState private var focused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Group {
        if secure {
          SecureField(placeholder, text: $text)
        } else {
          TextField(placeholder, text: $text)
        }
      }
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

/// Full-width filled action (auth, forms). Shows a spinner in place of the
/// label while `busy`, so the button keeps its size and the tap target never
/// moves under the user's finger.
struct PrimaryButton: View {
  let title: String
  var busy: Bool = false
  var enabled: Bool = true
  let action: () -> Void

  init(_ title: String, busy: Bool = false, enabled: Bool = true,
       action: @escaping () -> Void) {
    self.title = title
    self.busy = busy
    self.enabled = enabled
    self.action = action
  }

  var body: some View {
    Button(action: action) {
      Group {
        if busy {
          ProgressView().controlSize(.small).tint(Color.onHero)
        } else {
          Text(title).font(.rowLabel(15))
        }
      }
      .foregroundStyle(Color.onHero)
      .frame(maxWidth: .infinity, minHeight: 52)
      .background(
        Color.primaryContainer,
        in: RoundedRectangle(cornerRadius: Radii.input, style: .continuous))
    }
    .buttonStyle(.plain)
    .disabled(!enabled || busy)
    .opacity(enabled && !busy ? 1 : 0.5)
  }
}

/// Text-only secondary action ("I already have an account", "Back to login").
struct TextButton: View {
  let title: String
  let action: () -> Void

  init(_ title: String, action: @escaping () -> Void) {
    self.title = title
    self.action = action
  }

  var body: some View {
    Button(action: action) {
      Text(title)
        .font(.rowLabel(14))
        .foregroundStyle(Color.brandPrimary)
        .frame(maxWidth: .infinity, minHeight: 44)
        .contentShape(.rect)
    }
    .buttonStyle(.plain)
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
