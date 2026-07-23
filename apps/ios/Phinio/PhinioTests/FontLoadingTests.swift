import Testing
import UIKit
@testable import Phinio

struct FontLoadingTests {
  /// A wrong PostScript name silently falls back to the system font and still
  /// builds green — this fails loudly if any vendored font didn't register.
  @Test func vendoredFontsLoad() {
    let postScriptNames = [
      "Manrope-Regular", "Manrope-Medium", "Manrope-SemiBold", "Manrope-Bold", "Manrope-ExtraBold",
      "Inter-Regular", "Inter-Medium", "Inter-SemiBold", "Inter-Bold",
    ]
    for name in postScriptNames {
      #expect(UIFont(name: name, size: 12) != nil, "Font \(name) failed to load")
    }
  }
}
