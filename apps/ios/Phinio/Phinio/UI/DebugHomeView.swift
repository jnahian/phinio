import SwiftData
import SwiftUI

/// Throwaway foundation screen proving the full loop: local write → outbox →
/// drain → snapshot. Plan 3 replaces it with the real tab bar.
struct DebugHomeView: View {
  @EnvironmentObject private var auth: AuthManager
  @EnvironmentObject private var sync: SyncEngine
  @Environment(\.modelContext) private var context

  @Query private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var investments: [Investment]
  @Query private var outbox: [PendingMutation]
  @Query private var issues: [SyncIssue]

  var body: some View {
    NavigationStack {
      List {
        Section("Sync") {
          LabeledContent("State", value: String(describing: sync.state))
          Button("Sync now") { Task { await sync.syncNow() } }
        }
        Section("Data") {
          LabeledContent("EMIs", value: "\(emis.count)")
          LabeledContent("Payments", value: "\(payments.count)")
          LabeledContent("Investments", value: "\(investments.count)")
          LabeledContent("Outbox", value: "\(outbox.count)")
          LabeledContent("Sync issues", value: "\(issues.count)")
        }
        Section {
          Button("Create sample EMI") {
            try? Store(context: context).createEmi(
              label: "Debug loan \(Int.random(in: 100...999))",
              type: .bankLoan,
              principal: Money.decimal("50000")!,
              interestRate: Money.decimal("11.5")!,
              tenureMonths: 6, startDate: Date(), notes: nil)
            Task { await sync.syncNow() }
          }
          Button("Sign out", role: .destructive) {
            auth.signOut(container: context.container)
          }
        }
      }
      .navigationTitle("Phinio (debug)")
    }
  }
}
