import SwiftData
import SwiftUI

struct LumpSumDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var withdrawals: [InvestmentWithdrawal]
  @State private var editing = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  var body: some View {
    List {
      Section {
        LabeledContent("Type") { Text(investmentTypeLabel(investment.type)) }
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Invested") { MoneyText(amount: investment.investedAmount) }
        LabeledContent("Current value") { MoneyText(amount: investment.currentValue) }
        if let exit = investment.exitValue {
          LabeledContent("Exit value") { MoneyText(amount: exit) }
        }
        if let date = investment.dateOfInvestment {
          LabeledContent("Invested on") { Text(date, style: .date) }
        }
        if let notes = investment.notes {
          Text(notes).font(.callout).foregroundStyle(.secondary)
        }
      }
      if !withdrawals.isEmpty {
        Section("Withdrawals") {
          ForEach(withdrawals) { w in
            HStack {
              VStack(alignment: .leading) {
                Text(w.withdrawalDate, style: .date)
                if let n = w.notes {
                  Text(n).font(.caption).foregroundStyle(.secondary)
                }
              }
              Spacer()
              MoneyText(amount: w.amount).font(.body.monospacedDigit())
            }
          }
        }
      }
      if investment.status == "active" {
        Section {
          Button("Withdraw") { withdrawing = true }
        }
      }
      Section {
        Button("Delete investment", role: .destructive) { confirmDelete = true }
      }
    }
    .navigationTitle(investment.name)
    .toolbar {
      Button("Edit") { editing = true }
    }
    .sheet(isPresented: $editing) { LumpSumFormView(existing: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog("Delete this investment?", isPresented: $confirmDelete,
                        titleVisibility: .visible) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }
}
