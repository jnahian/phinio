import Testing

@testable import Phinio

struct DeepLinkTests {
  @Test func parsesServerLinkStrings() {
    #expect(DeepLink.parse("/app/emis/abc-123") == .emi("abc-123"))
    #expect(DeepLink.parse("/app/investments/dps/xyz") == .dps("xyz"))
    #expect(DeepLink.parse("/app/activity") == nil)
    #expect(DeepLink.parse("") == nil)
  }
}
