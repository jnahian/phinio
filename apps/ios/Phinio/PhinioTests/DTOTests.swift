import Foundation
import Testing
@testable import Phinio

struct DTOTests {
  @Test func decodesSnapshotWithMoneyStringsAndDates() throws {
    let json = """
    {
      "serverTime": "2026-07-16T19:28:23.190Z",
      "profile": {"id": "p1", "fullName": "N", "preferredCurrency": "BDT",
                  "preferredLanguage": "en", "updatedAt": "2026-07-16T19:28:08.727Z"},
      "investments": [],
      "investmentDeposits": [],
      "investmentWithdrawals": [],
      "emis": [{"id": "e1", "label": "Car", "type": "bank_loan",
                "principal": "100000", "interestRate": "12", "tenureMonths": 12,
                "emiAmount": "8884.88", "startDate": "2026-01-15T00:00:00.000Z",
                "status": "active", "notes": null,
                "createdAt": "2026-07-16T19:28:08.727Z",
                "updatedAt": "2026-07-16T19:28:08.727Z", "profileId": "p1"}],
      "emiPayments": [],
      "notifications": []
    }
    """.data(using: .utf8)!
    let snap = try JSONDecoder().decode(SnapshotDTO.self, from: json)
    #expect(snap.profile.id == "p1")
    #expect(snap.emis.count == 1)
    #expect(snap.emis[0].principal == "100000")
    #expect(WireDate.timestamp(snap.emis[0].startDate) != nil)
  }

  // Contract drift (missing field, wrong-typed money) must throw at the
  // decode boundary rather than produce a half-decoded snapshot.
  @Test func malformedSnapshotThrows() {
    let missingField = Data("""
    {"serverTime": "2026-07-16T19:28:23.190Z",
     "profile": {"id": "p1", "fullName": "N", "preferredCurrency": "BDT",
                 "preferredLanguage": "en", "updatedAt": null},
     "investments": [], "investmentDeposits": [], "investmentWithdrawals": [],
     "emiPayments": [], "notifications": []}
    """.utf8) // "emis" absent
    #expect(throws: DecodingError.self) {
      try JSONDecoder().decode(SnapshotDTO.self, from: missingField)
    }

    let numberMoney = Data("""
    {"serverTime": "2026-07-16T19:28:23.190Z",
     "profile": {"id": "p1", "fullName": "N", "preferredCurrency": "BDT",
                 "preferredLanguage": "en", "updatedAt": null},
     "investments": [], "investmentDeposits": [], "investmentWithdrawals": [],
     "emis": [{"id": "e1", "label": "Car", "type": "bank_loan",
               "principal": 100000, "interestRate": "12", "tenureMonths": 12,
               "emiAmount": "8884.88", "startDate": "2026-01-15T00:00:00.000Z",
               "status": "active", "notes": null,
               "createdAt": "2026-07-16T19:28:08.727Z",
               "updatedAt": "2026-07-16T19:28:08.727Z", "profileId": "p1"}],
     "emiPayments": [], "notifications": []}
    """.utf8) // principal as a JSON number, not the wire's money string
    #expect(throws: DecodingError.self) {
      try JSONDecoder().decode(SnapshotDTO.self, from: numberMoney)
    }
  }
}
