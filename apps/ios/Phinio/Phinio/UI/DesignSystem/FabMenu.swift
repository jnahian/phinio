import SwiftUI

/// The four global create flows behind the FAB. Presented as sheets — a global
/// FAB has no unambiguous stack to push onto.
enum CreateSheet: String, Identifiable, CaseIterable {
  case investment, dps, savings, emi
  var id: String { rawValue }

  var label: LocalizedStringKey {
    switch self {
    case .investment: "Investment"
    case .dps: "DPS Scheme"
    case .savings: "Savings Pot"
    case .emi: "EMI"
    }
  }

  var symbol: String {
    switch self {
    case .investment: "chart.line.uptrend.xyaxis"
    case .dps: "calendar"
    case .savings: "banknote"
    case .emi: "creditcard"
    }
  }

  var tint: Color {
    switch self {
    case .investment: .brandPrimary
    case .dps: TypePalette.dps
    case .savings: TypePalette.savings
    case .emi: TypePalette.crypto
    }
  }

  /// Tab that owns the created record — the FAB switches to it on tap so the
  /// sheet is dismissed onto the right list.
  var owningTab: AppTab { self == .emi ? .emis : .invest }
}

/// Scrim + staggered option stack. Rendered as an overlay on each stack's root
/// *before* the tab bar's `safeAreaInset`, so the bar and FAB stay above it.
struct FabMenu: View {
  @Binding var isOpen: Bool
  let onSelect: (CreateSheet) -> Void

  @State private var shown = false

  var body: some View {
    ZStack(alignment: .bottomTrailing) {
      // ponytail: flat scrim color, no 3pt backdrop blur — a real blur means
      // rendering the whole screen into a layer for 3pt of softening.
      Color.surfaceLowest.opacity(0.62)
        .ignoresSafeArea()
        .onTapGesture { isOpen = false }

      VStack(alignment: .trailing, spacing: 13) {
        ForEach(Array(CreateSheet.allCases.enumerated()), id: \.element) { index, option in
          row(option, delay: 0.02 + Double(index) * 0.04)
        }
      }
      .padding(.trailing, 20)
      // The overlay is inset above the tab bar (it's applied before the bar's
      // safeAreaInset), so its bottom edge already sits at the bar's top — where
      // the FAB is. A small gap places the lowest option just above the FAB,
      // not 114pt of screen-bottom offset stacked on top of the inset.
      .padding(.bottom, 14)
    }
    .onAppear { shown = true }
  }

  private func row(_ option: CreateSheet, delay: Double) -> some View {
    Button { onSelect(option) } label: {
      HStack(spacing: 13) {
        Text(option.label)
          .font(.rowLabel(13))
          .foregroundStyle(Color.onSurface)
          .padding(.vertical, 9)
          .padding(.horizontal, 13)
          .background(Color.surfaceHigh, in: .rect(cornerRadius: Radii.input))
          .shadow(color: Shadows.fabItem.color, radius: Shadows.fabItem.radius,
                  x: Shadows.fabItem.x, y: Shadows.fabItem.y)

        Image(systemName: option.symbol)
          .font(.system(size: 22))
          .foregroundStyle(option.tint)
          .frame(width: 50, height: 50)
          .background(Color.surfaceHighest, in: .circle)
          .shadow(color: Shadows.fabItem.color, radius: Shadows.fabItem.radius,
                  x: Shadows.fabItem.x, y: Shadows.fabItem.y)
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
    .accessibilityLabel(option.label)
    .accessibilityAddTraits(.isButton)
    .opacity(shown ? 1 : 0)
    .scaleEffect(shown ? 1 : 0.94)
    .offset(y: shown ? 0 : 10)
    .animation(.spring(duration: 0.24, bounce: 0.35).delay(delay), value: shown)
  }
}
