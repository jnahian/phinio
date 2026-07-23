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

/// Connectivity strip under the top bar (brief §3, §6).
struct OfflineBanner: View {
  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: "wifi.slash").font(.system(size: 12))
      Text("Offline — changes sync when you reconnect.").font(.meta)
    }
    .foregroundStyle(Color.tertiaryFixedDim)
    .frame(maxWidth: .infinity)
    .padding(.vertical, 8)
    .background(Color.tertiaryContainer.opacity(0.12))
    .accessibilityElement(children: .combine)
  }
}

/// Sub-screen header: 40pt circular back button, title with optional subtitle,
/// optional trailing accessory (type badge / edit pencil / "Edit"). Pushed
/// screens hide the system nav bar and use this instead; the custom tab bar
/// needs no hiding modifier because it is attached to each stack's root.
struct DetailHeader<Trailing: View>: View {
  let title: String
  var subtitle: String? = nil
  let onBack: () -> Void
  @ViewBuilder var trailing: Trailing

  var body: some View {
    HStack(spacing: 12) {
      Button(action: onBack) {
        Image(systemName: "chevron.left")
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(Color.brandPrimary)
          .frame(width: 40, height: 40)
          .background(Color.brandPrimary.opacity(0.08), in: .circle)
          .contentShape(.circle)
      }
      .buttonStyle(.plain)
      .accessibilityLabel("Back")

      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .font(.detailTitle)
          .foregroundStyle(Color.onSurface)
          .lineLimit(1)
        if let subtitle {
          Text(subtitle)
            .font(.custom("Inter-Medium", size: 11.5))
            .foregroundStyle(Color.onSurfaceVariant)
            .lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      trailing
    }
    .padding(.horizontal, Layout.screenHorizontalPadding)
    .padding(.top, 6)
    .padding(.bottom, 18)
  }
}

extension DetailHeader where Trailing == EmptyView {
  init(title: String, subtitle: String? = nil, onBack: @escaping () -> Void) {
    self.init(title: title, subtitle: subtitle, onBack: onBack) { EmptyView() }
  }
}
