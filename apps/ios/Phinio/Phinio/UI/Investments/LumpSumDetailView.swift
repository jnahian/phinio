import SwiftData
import SwiftUI

struct LumpSumDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var withdrawals: [InvestmentWithdrawal]
  @Query private var profiles: [Profile]
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

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var value: Decimal { investment.exitValue ?? investment.currentValue }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    return (value - investment.investedAmount) / investment.investedAmount * 100
  }

  var body: some View {
    List {
      Section {
        hero
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        LabeledContent("Invested") {
          MoneyText(amount: investment.investedAmount)
            .monospacedDigit()
        }
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Type") { TypeBadge(type: investment.type) }
        if let date = investment.dateOfInvestment {
          LabeledContent("Invested on") {
            Text(date, format: .dateTime.day().month(.wide).year())
          }
        }
        if let closure = investment.estimatedClosureDate {
          LabeledContent("Estimated closure") {
            Text(closure, format: .dateTime.day().month(.wide).year())
          }
        }
        if let notes = investment.notes, !notes.isEmpty {
          LabeledContent("Notes") { Text(notes) }
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
          if investment.status == "active" {
            Button { withdrawing = true } label: {
              Label("Withdraw", systemImage: "arrow.up.circle")
            }
          }
          Button(role: .destructive) { confirmDelete = true } label: {
            Label("Delete investment", systemImage: "trash")
          }
        } label: {
          Label("More", systemImage: "ellipsis.circle")
        }
      }
    }
    .sheet(isPresented: $editing) { LumpSumFormView(existing: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog(
      "Delete this investment?", isPresented: $confirmDelete, titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }

  private var hero: some View {
    HeroCard(
      gradient: Gradients.netWorthHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text(investment.exitValue == nil ? "Current Value" : "Exit Value")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.72))
        Text(value.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        if let pct = returnPercent {
          MoneyPill(percent: pct, size: .hero).padding(.top, 10)
        }
      }
    }
  }
}

/// Shared by LumpSumDetailView and SavingsDetailView.
struct WithdrawalRow: View {
  let withdrawal: InvestmentWithdrawal
  let currency: String

  var body: some View {
    TransactionRow(
      symbol: "arrow.up",
      tint: .red,
      title: withdrawal.notes.map(Text.init(verbatim:)) ?? Text("Withdrawal"),
      subtitle: Text(
        withdrawal.withdrawalDate, format: .dateTime.day().month(.abbreviated).year()),
      amount: Text(verbatim: "− " + withdrawal.amount.currency(currency)),
      amountTint: .red)
  }
}
