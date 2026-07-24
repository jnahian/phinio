import SwiftData
import SwiftUI

struct SavingsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]
  @Query private var profiles: [Profile]
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

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    return (investment.currentValue - investment.investedAmount)
      / investment.investedAmount * 100
  }

  var body: some View {
    List {
      Section {
        hero
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        HStack(spacing: 10) {
          StatTile(
            label: "Total deposited",
            value: investment.investedAmount.currencyCompact(currency),
            alignment: .leading)
          StatTile(
            label: "Deposits", value: "\(deposits.count)",
            alignment: .leading)
        }
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      if investment.status == "active" {
        Section {
          Button { addingDeposit = true } label: {
            Label("Add deposit", systemImage: "plus.circle")
          }
          Button { withdrawing = true } label: {
            Label("Withdraw", systemImage: "arrow.up.circle")
          }
        }
      }

      Section("Deposit history") {
        if deposits.isEmpty {
          Text("No deposits yet")
            .font(.subheadline).foregroundStyle(.secondary)
        }
        ForEach(deposits) { dep in
          depositRow(dep)
            .swipeActions {
              if investment.status == "active" {
                Button("Remove", role: .destructive) {
                  try? Store(context: context).removeDeposit(dep, from: investment)
                  Task { await sync.syncNow() }
                }
              }
            }
        }
      }

      if !withdrawals.isEmpty {
        Section("Withdrawals") {
          ForEach(withdrawals) { w in
            WithdrawalRow(withdrawal: w, currency: currency)
          }
        }
      }
    }
    .navigationTitle(investment.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
          Button(role: .destructive) { confirmDelete = true } label: {
            Label("Delete savings pot", systemImage: "trash")
          }
        } label: {
          Label("More", systemImage: "ellipsis.circle")
        }
      }
    }
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

  private var hero: some View {
    HeroCard(
      gradient: Gradients.savingsHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Current Balance")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.72))
        Text(investment.currentValue.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        if let pct = returnPercent, !deposits.isEmpty {
          MoneyPill(percent: pct, size: .hero).padding(.top, 12)
        }
      }
    }
  }

  private func depositRow(_ dep: InvestmentDeposit) -> some View {
    HStack(spacing: 12) {
      IconTile(size: 38, radius: 11, background: Color.green.opacity(0.12)) {
        Image(systemName: "arrow.down")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(.green)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(dep.notes ?? "Deposit")
          .font(.body).lineLimit(1)
        if let d = dep.depositDate {
          Text(d, format: .dateTime.day().month(.abbreviated).year())
            .font(.caption).foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      Text("+ " + dep.amount.currency(currency))
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .foregroundStyle(.green)
        .lineLimit(1).minimumScaleFactor(0.6)
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
    .presentationDetents([.medium, .large])
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
