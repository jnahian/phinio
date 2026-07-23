import SwiftUI

/// App root on first launch (brief §5.1). Replaces the old three-page welcome
/// carousel — the App Store listing does the explaining, this just establishes
/// the brand and routes to signup or login.
struct GetStartedView: View {
  let onSignUp: () -> Void
  let onLogin: () -> Void

  /// Entry chain on the brief's timeline. `PhaseAnimator` would re-run the
  /// whole chain on any state change; a single `appeared` flag with per-element
  /// delays gives the same staggered result and settles permanently.
  @State private var appeared = false
  @State private var breathing = false

  var body: some View {
    ZStack {
      Color.surface.ignoresSafeArea()
      orb
      VStack(spacing: 0) {
        Spacer()
        logo
        wordmark.padding(.top, 28)
        Spacer()
        actions
        footer.padding(.top, 18)
      }
      .padding(.horizontal, 36)
      .padding(.bottom, 40)
    }
    .onAppear {
      appeared = true
      breathing = true
    }
  }

  // MARK: Pieces

  private var orb: some View {
    Circle()
      .fill(Color.primaryContainer.opacity(0.05))
      .frame(width: 420, height: 420)
      .blur(radius: 120)
      .scaleEffect(breathing ? 1.12 : 0.92)
      .animation(
        .easeInOut(duration: 6).repeatForever(autoreverses: true), value: breathing)
      .allowsHitTesting(false)
      .accessibilityHidden(true)
  }

  private var logo: some View {
    ZStack(alignment: .topTrailing) {
      // Glow reads through from behind the tile.
      RoundedRectangle(cornerRadius: 32, style: .continuous)
        .fill(Color.primaryContainer.opacity(0.20))
        .frame(width: 144, height: 144)
        .blur(radius: 34)
        .scaleEffect(1.25)
        .opacity(breathing ? 1.0 : 0.6)
        .animation(
          .easeInOut(duration: 2.4).repeatForever(autoreverses: true), value: breathing)

      Image("PhinioLogo")
        .resizable()
        .scaledToFit()
        .frame(width: 144, height: 144)
        .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: 32, style: .continuous)
            .strokeBorder(Color.onHero.opacity(0.05), lineWidth: 1))
        .shadow(color: Color(white: 0).opacity(0.5), radius: 40, y: 18)

      Circle()
        .fill(Color.brandSecondary)
        .frame(width: 18, height: 18)
        .overlay(Circle().strokeBorder(Color.surface, lineWidth: 3))
        .offset(x: 5, y: -5)
        .scaleEffect(appeared ? 1 : 0.1)
        .animation(.spring(duration: 0.5, bounce: 0.45).delay(0.4), value: appeared)
    }
    .scaleEffect(appeared ? 1 : 0.8)
    .opacity(appeared ? 1 : 0)
    .animation(.spring(duration: 0.5, bounce: 0.3).delay(0.1), value: appeared)
    .accessibilityHidden(true)
  }

  private var wordmark: some View {
    VStack(spacing: 12) {
      Text("Phinio")
        .font(.custom("Manrope-ExtraBold", size: 48))
        .tracking(-0.02 * 48)
        .foregroundStyle(Color.onSurface)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 12)
        .animation(.spring(duration: 0.5, bounce: 0.2).delay(0.5), value: appeared)

      Text("Digital private vault")
        .font(.custom("Inter-SemiBold", size: 14))
        .tracking(0.2 * 14)
        .textCase(.uppercase)
        .foregroundStyle(Color.onSurfaceVariant)
        .opacity(appeared ? 1 : 0)
        .animation(.easeOut(duration: 0.4).delay(0.7), value: appeared)
    }
  }

  private var actions: some View {
    VStack(spacing: 4) {
      PrimaryButton("Get Started", action: onSignUp)
      TextButton("I already have an account", action: onLogin)
    }
    .frame(maxWidth: 320)
    .opacity(appeared ? 1 : 0)
    .offset(y: appeared ? 0 : 12)
    .animation(.spring(duration: 0.5, bounce: 0.2).delay(0.9), value: appeared)
  }

  private var footer: some View {
    Text(versionLine)
      .font(.meta)
      .foregroundStyle(Color.onSurfaceMuted)
      .opacity(appeared ? 1 : 0)
      .animation(.easeOut(duration: 0.4).delay(1.1), value: appeared)
  }

  private var versionLine: String {
    let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    return "Version \(v)"
  }
}
