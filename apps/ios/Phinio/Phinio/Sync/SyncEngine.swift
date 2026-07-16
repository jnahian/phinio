import Combine
import Foundation
import SwiftData

enum SyncState: Equatable {
  case idle, syncing, offline, unauthorized
}

/// Drains the PendingMutation outbox FIFO, then pulls a full snapshot and
/// replaces local domain state wholesale. Snapshot apply is skipped while
/// any outbox rows remain so unsynced local writes are never clobbered.
/// ponytail: main-actor sync over mainContext; move to a ModelActor if
/// snapshot apply ever janks the UI at real data sizes.
@MainActor
final class SyncEngine: ObservableObject {
  @Published private(set) var state: SyncState = .idle

  private let transport: SyncTransport
  private let container: ModelContainer
  private var context: ModelContext { container.mainContext }

  init(transport: SyncTransport, container: ModelContainer) {
    self.transport = transport
    self.container = container
  }

  func syncNow() async {
    guard state != .syncing else { return }
    state = .syncing

    let drained = await drainOutbox()
    guard drained else { return } // state already set by the failure path

    let remaining = (try? context.fetchCount(FetchDescriptor<PendingMutation>())) ?? 0
    if remaining == 0 {
      await pullSnapshot()
    }
    if state == .syncing { state = .idle }
  }

  /// Returns false when the drain stopped on a retryable/auth failure.
  private func drainOutbox() async -> Bool {
    var descriptor = FetchDescriptor<PendingMutation>(
      sortBy: [SortDescriptor(\.createdAt, order: .forward)])
    descriptor.fetchLimit = 1

    while let mutation = (try? context.fetch(descriptor))?.first {
      do {
        try await transport.post(
          path: mutation.path, body: mutation.body,
          method: mutation.method, idempotencyKey: mutation.id)
        context.delete(mutation)
        try? context.save()
      } catch let error as APIError {
        switch error {
        case .rejected(_, let message):
          context.insert(SyncIssue(
            id: UUID(), path: mutation.path, message: message,
            occurredAt: Date()))
          context.delete(mutation)
          try? context.save()
        case .unauthorized:
          state = .unauthorized
          return false
        case .retryable, .decoding:
          mutation.attemptCount += 1
          try? context.save()
          state = .offline
          return false
        }
      } catch {
        state = .offline
        return false
      }
    }
    return true
  }

  private func pullSnapshot() async {
    do {
      let snap = try await transport.fetchSnapshot()
      try apply(snap)
    } catch let error as APIError where error == .unauthorized {
      state = .unauthorized
    } catch {
      state = .offline
    }
  }

  private func apply(_ snap: SnapshotDTO) throws {
    // Wholesale replace: server is the source of truth once the outbox is
    // empty; deletes fall out for free.
    try context.delete(model: Profile.self)
    try context.delete(model: Investment.self)
    try context.delete(model: InvestmentDeposit.self)
    try context.delete(model: InvestmentWithdrawal.self)
    try context.delete(model: Emi.self)
    try context.delete(model: EmiPayment.self)
    try context.delete(model: AppNotification.self)

    let now = Date()
    func ts(_ s: String?) -> Date? { s.flatMap(WireDate.timestamp) }
    func money(_ s: String) -> Decimal { Money.decimal(s) ?? 0 }

    let p = snap.profile
    context.insert(Profile(
      id: p.id, fullName: p.fullName, preferredCurrency: p.preferredCurrency,
      preferredLanguage: p.preferredLanguage, updatedAt: ts(p.updatedAt) ?? now))

    for i in snap.investments {
      context.insert(Investment(
        id: i.id, name: i.name, type: i.type, mode: i.mode, status: i.status,
        investedAmount: money(i.investedAmount), currentValue: money(i.currentValue),
        exitValue: i.exitValue.map(money), dateOfInvestment: ts(i.dateOfInvestment),
        startDate: ts(i.startDate), monthlyDeposit: i.monthlyDeposit.map(money),
        tenureMonths: i.tenureMonths, interestRate: i.interestRate.map(money),
        interestType: i.interestType, estimatedClosureDate: ts(i.estimatedClosureDate),
        completedAt: ts(i.completedAt), notes: i.notes,
        updatedAt: ts(i.updatedAt) ?? now))
    }
    for d in snap.investmentDeposits {
      context.insert(InvestmentDeposit(
        id: d.id, investmentId: d.investmentId, amount: money(d.amount),
        dueDate: ts(d.dueDate), depositDate: ts(d.depositDate),
        installmentNumber: d.installmentNumber, status: d.status,
        notes: d.notes, updatedAt: ts(d.updatedAt) ?? now))
    }
    for w in snap.investmentWithdrawals {
      context.insert(InvestmentWithdrawal(
        id: w.id, investmentId: w.investmentId, amount: money(w.amount),
        withdrawalDate: ts(w.withdrawalDate) ?? now, notes: w.notes))
    }
    for e in snap.emis {
      context.insert(Emi(
        id: e.id, label: e.label, type: e.type, principal: money(e.principal),
        interestRate: money(e.interestRate), tenureMonths: e.tenureMonths,
        emiAmount: money(e.emiAmount), startDate: ts(e.startDate) ?? now,
        status: e.status, notes: e.notes, updatedAt: ts(e.updatedAt) ?? now))
    }
    for pay in snap.emiPayments {
      context.insert(EmiPayment(
        id: pay.id, emiId: pay.emiId, paymentNumber: pay.paymentNumber,
        dueDate: ts(pay.dueDate) ?? now, emiAmount: money(pay.emiAmount),
        principalComponent: money(pay.principalComponent),
        interestComponent: money(pay.interestComponent),
        remainingBalance: money(pay.remainingBalance), status: pay.status,
        paidAt: ts(pay.paidAt), updatedAt: ts(pay.updatedAt) ?? now))
    }
    for n in snap.notifications {
      context.insert(AppNotification(
        id: n.id, type: n.type, title: n.title, body: n.body, link: n.link,
        readAt: ts(n.readAt), createdAt: ts(n.createdAt) ?? now))
    }
    try context.save()
  }
}
