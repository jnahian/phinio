import Foundation
import SwiftData
import Testing
@testable import Phinio

/// Scriptable transport: per-call results for post(), canned snapshot.
final class MockTransport: SyncTransport, @unchecked Sendable {
  var postResults: [Result<Void, APIError>] = []
  var postedPaths: [String] = []
  var postedKeys: [UUID] = []
  var snapshot: SnapshotDTO?
  var snapshotFetchCount = 0

  func post(path: String, body: Data?, method: String, idempotencyKey: UUID) async throws {
    postedPaths.append(path)
    postedKeys.append(idempotencyKey)
    let result = postResults.isEmpty ? .success(()) : postResults.removeFirst()
    if case .failure(let e) = result { throw e }
  }

  func fetchSnapshot() async throws -> SnapshotDTO {
    snapshotFetchCount += 1
    guard let snapshot else { throw APIError.retryable }
    return snapshot
  }
}

private func emptySnapshot() -> SnapshotDTO {
  SnapshotDTO(
    serverTime: "2026-07-17T00:00:00.000Z",
    profile: ProfileDTO(
      id: "p1", fullName: "N", preferredCurrency: "BDT",
      preferredLanguage: "en", updatedAt: "2026-07-17T00:00:00.000Z"),
    investments: [], investmentDeposits: [], investmentWithdrawals: [],
    emis: [], emiPayments: [], notifications: [])
}

@MainActor
private func makeEngine(_ transport: MockTransport) throws -> (SyncEngine, ModelContext) {
  let container = try makeModelContainer(inMemory: true)
  return (SyncEngine(transport: transport, container: container), container.mainContext)
}

@MainActor
private func enqueue(_ context: ModelContext, path: String, at date: Date) -> PendingMutation {
  let m = PendingMutation(
    id: UUID(), method: "POST", path: path, body: Data("{}".utf8),
    createdAt: date, attemptCount: 0)
  context.insert(m)
  try! context.save()
  return m
}

@MainActor
struct SyncEngineTests {
  @Test func drainsOutboxFIFOThenPullsSnapshot() async throws {
    let transport = MockTransport()
    transport.snapshot = emptySnapshot()
    let (engine, context) = try makeEngine(transport)
    let first = enqueue(context, path: "/first", at: Date(timeIntervalSince1970: 1))
    _ = enqueue(context, path: "/second", at: Date(timeIntervalSince1970: 2))

    await engine.syncNow()

    #expect(transport.postedPaths == ["/first", "/second"])
    #expect(transport.postedKeys.first == first.id)
    #expect(try context.fetchCount(FetchDescriptor<PendingMutation>()) == 0)
    #expect(transport.snapshotFetchCount == 1)
    #expect(try context.fetchCount(FetchDescriptor<Profile>()) == 1)
    #expect(engine.state == .idle)
  }

  @Test func retryableErrorStopsDrainAndSkipsSnapshot() async throws {
    let transport = MockTransport()
    transport.postResults = [.failure(.retryable)]
    transport.snapshot = emptySnapshot()
    let (engine, context) = try makeEngine(transport)
    _ = enqueue(context, path: "/first", at: Date(timeIntervalSince1970: 1))
    _ = enqueue(context, path: "/second", at: Date(timeIntervalSince1970: 2))

    await engine.syncNow()

    #expect(transport.postedPaths == ["/first"]) // stopped at the failure
    #expect(try context.fetchCount(FetchDescriptor<PendingMutation>()) == 2) // kept
    #expect(transport.snapshotFetchCount == 0) // outbox non-empty → no pull
    #expect(engine.state == .offline)
  }

  @Test func rejectedMutationIsDroppedRecordedAndDrainContinues() async throws {
    let transport = MockTransport()
    transport.postResults = [
      .failure(.rejected(code: "rejected", message: "Withdrawal amount exceeds current value")),
      .success(()),
    ]
    transport.snapshot = emptySnapshot()
    let (engine, context) = try makeEngine(transport)
    _ = enqueue(context, path: "/bad", at: Date(timeIntervalSince1970: 1))
    _ = enqueue(context, path: "/good", at: Date(timeIntervalSince1970: 2))

    await engine.syncNow()

    #expect(transport.postedPaths == ["/bad", "/good"])
    #expect(try context.fetchCount(FetchDescriptor<PendingMutation>()) == 0)
    let issues = try context.fetch(FetchDescriptor<SyncIssue>())
    #expect(issues.count == 1)
    #expect(issues.first?.message.contains("exceeds") == true)
    #expect(transport.snapshotFetchCount == 1)
  }

  @Test func unauthorizedFlipsStateAndStops() async throws {
    let transport = MockTransport()
    transport.postResults = [.failure(.unauthorized)]
    let (engine, context) = try makeEngine(transport)
    _ = enqueue(context, path: "/first", at: Date(timeIntervalSince1970: 1))

    await engine.syncNow()

    #expect(engine.state == .unauthorized)
    #expect(try context.fetchCount(FetchDescriptor<PendingMutation>()) == 1)
  }

  @Test func snapshotApplyReplacesLocalStateWholesale() async throws {
    let transport = MockTransport()
    var snap = emptySnapshot()
    transport.snapshot = snap
    let (engine, context) = try makeEngine(transport)
    // Pre-existing local row the snapshot doesn't contain — a server-side
    // delete — must vanish after apply.
    context.insert(Emi(
      id: "stale", label: "Deleted elsewhere", type: "bank_loan",
      principal: 1, interestRate: 1, tenureMonths: 1, emiAmount: 1,
      startDate: Date(), status: "active", notes: nil, updatedAt: Date()))
    try context.save()

    await engine.syncNow()

    #expect(try context.fetchCount(FetchDescriptor<Emi>()) == 0)
    _ = snap // silence unused warning if any
  }
}
