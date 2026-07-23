import Foundation
import SwiftData

/// One queued offline write. `id` doubles as the Idempotency-Key the server
/// dedupes on, so retries are safe. Drained FIFO by createdAt.
@Model
final class PendingMutation {
  @Attribute(.unique) var id: UUID
  var method: String
  var path: String
  var body: Data?
  var createdAt: Date
  var attemptCount: Int

  init(id: UUID, method: String, path: String, body: Data?,
       createdAt: Date, attemptCount: Int) {
    self.id = id
    self.method = method
    self.path = path
    self.body = body
    self.createdAt = createdAt
    self.attemptCount = attemptCount
  }
}

/// A mutation the server permanently rejected (4xx). Surfaced in Settings.
@Model
final class SyncIssue {
  @Attribute(.unique) var id: UUID
  var path: String
  var message: String
  var occurredAt: Date

  init(id: UUID, path: String, message: String, occurredAt: Date) {
    self.id = id
    self.path = path
    self.message = message
    self.occurredAt = occurredAt
  }
}
