import Foundation
import Testing
@testable import Phinio

struct ActivityDTOTests {
  @Test func decodesActivityPage() throws {
    let json = #"""
    {
      "items": [{
        "id": "a1", "action": "update", "entityType": "emi_payment",
        "entityId": "p1", "entityLabel": "Car loan",
        "summary": "Marked payment #3 as paid",
        "changes": [{"field": "status", "from": "upcoming", "to": "paid"}],
        "createdAt": "2026-07-17T10:00:00.000Z"
      }],
      "nextCursor": null
    }
    """#
    let page = try JSONDecoder().decode(ActivityPageDTO.self,
                                        from: Data(json.utf8))
    #expect(page.items.count == 1)
    #expect(page.items[0].summary == "Marked payment #3 as paid")
    #expect(page.items[0].changes?.first?.to == "paid")
    #expect(page.nextCursor == nil)
  }
}
