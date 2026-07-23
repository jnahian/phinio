import SwiftUI

enum AppTab: Hashable { case home, invest, emis }

/// Hand-rolled replacement for `TabView`'s bar: a flexible glass pill with three
/// items plus a detached 62pt FAB, per the comp. Attached to each stack's root
/// via `.safeAreaInset(edge: .bottom)` so pushed detail screens cover it and
/// scroll content clears it without a hardcoded inset.
struct NoirTabBar: View {
  @Binding var selection: AppTab
  @Binding var fabOpen: Bool

  var body: some View {
    GlassEffectContainer {
      HStack(spacing: 12) {
        HStack(spacing: 2) {
          item(.home, "Home", "house")
          item(.invest, "Invest", "chart.line.uptrend.xyaxis")
          item(.emis, "EMIs", "creditcard")
        }
        .padding(8)
        .glassEffect(.regular.tint(Glass.fill), in: .rect(cornerRadius: Radii.tabPill))
        .overlay {
          RoundedRectangle(cornerRadius: Radii.tabPill)
            .strokeBorder(Glass.border, lineWidth: 0.5)
        }
        .shadow(color: Shadows.tabBar.color, radius: Shadows.tabBar.radius,
                x: Shadows.tabBar.x, y: Shadows.tabBar.y)

        fab
      }
      .padding(.horizontal, 16)
    }
  }

  private func item(_ tab: AppTab, _ label: LocalizedStringKey, _ symbol: String) -> some View {
    let active = selection == tab
    return Button {
      selection = tab
      fabOpen = false
    } label: {
      VStack(spacing: 5) {
        Image(systemName: symbol).font(.system(size: 23))
        Text(label).font(.tabLabel)
      }
      .foregroundStyle(active ? Color.onSurface : Color.tabIdle)
      .frame(maxWidth: .infinity, minHeight: 44)
      .padding(.vertical, 9)
      .background(active ? Color.brandPrimary.opacity(0.16) : .clear,
                  in: .rect(cornerRadius: 22))
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label)
    .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
  }

  private var fab: some View {
    Button { fabOpen.toggle() } label: {
      Image(systemName: "plus")
        .font(.system(size: 27, weight: .semibold))
        .foregroundStyle(Color.brandPrimary)
        .rotationEffect(.degrees(fabOpen ? 45 : 0))
        .frame(width: 62, height: 62)
        .contentShape(.circle)
    }
    .buttonStyle(.plain)
    .glassEffect(.regular.tint(Glass.fill), in: .circle)
    .overlay { Circle().strokeBorder(Glass.border, lineWidth: 0.5) }
    .shadow(color: Shadows.tabBar.color, radius: Shadows.tabBar.radius,
            x: Shadows.tabBar.x, y: Shadows.tabBar.y)
    .accessibilityLabel("Add")
    .accessibilityAddTraits(.isButton)
    .animation(.spring(duration: 0.25, bounce: 0.3), value: fabOpen)
  }
}
