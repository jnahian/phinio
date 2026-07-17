import SwiftData
import SwiftUI

struct SavingsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]
  @State private var editing = false
  @State private var addingDeposit = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.depositDate, order: .reverse)])
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  var body: some View {
    List {
      Section {
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Balance") { MoneyText(amount: investment.currentValue) }
        LabeledContent("Total deposited") {
          MoneyText(amount: investment.investedAmount)
        }
        if let notes = investment.notes {
          Text(notes).font(.callout).foregroundStyle(.secondary)
        }
      }
      Section("Deposits") {
        if deposits.isEmpty {
          Text("No deposits yet").foregroundStyle(.secondary)
        }
        ForEach(deposits) { dep in
          HStack {
            VStack(alignment: .leading) {
              if let d = dep.depositDate { Text(d, style: .date) }
              if let n = dep.notes {
                Text(n).font(.caption).foregroundStyle(.secondary)
              }
            }
            Spacer()
            MoneyText(amount: dep.amount).font(.body.monospacedDigit())
          }
          .swipeActions {
            if investment.status == "active" {
              Button("Remove", role: .destructive) {
                try? Store(context: context)
                  .removeDeposit(dep, from: investment)
                Task { await sync.syncNow() }
              }
            }
          }
        }
      }
      if !withdrawals.isEmpty {
        Section("Withdrawals") {
          ForEach(withdrawals) { w in
            HStack {
              Text(w.withdrawalDate, style: .date)
              Spacer()
              MoneyText(amount: w.amount).font(.body.monospacedDigit())
            }
          }
        }
      }
      if investment.status == "active" {
        Section {
          Button("Add deposit") { addingDeposit = true }
          Button("Withdraw") { withdrawing = true }
        }
      }
      Section {
        Button("Delete savings", role: .destructive) { confirmDelete = true }
      }
    }
    .navigationTitle(investment.name)
    .toolbar { Button("Edit") { editing = true } }
    .sheet(isPresented: $editing) { SavingsFormView(existing: investment) }
    .sheet(isPresented: $addingDeposit) { AddDepositSheet(investment: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog("Delete this savings?", isPresented: $confirmDelete,
                        titleVisibility: .visible) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }
}

struct AddDepositSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var amount = ""
  @State private var depositDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        TextField("Amount", text: $amount).keyboardType(.decimalPad)
        DatePicker("Date", selection: $depositDate, displayedComponents: .date)
        TextField("Notes", text: $notes, axis: .vertical)
        if let error { Text(error).foregroundStyle(.red) }
      }
      .navigationTitle("Add deposit")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Add") { submit() }
            .disabled(Validate.positiveMoney(amount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
  }

  private func submit() {
    do {
      try Store(context: context).addDeposit(
        to: investment, amount: Validate.positiveMoney(amount)!,
        depositDate: depositDate, notes: Validate.notes(notes, max: 500)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
