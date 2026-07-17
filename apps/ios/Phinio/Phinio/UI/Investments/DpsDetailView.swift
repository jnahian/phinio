import SwiftData
import SwiftUI

struct DpsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @State private var editing = false
  @State private var closing = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.installmentNumber)])
  }

  private var paidCount: Int { deposits.filter { $0.status == "paid" }.count }

  var body: some View {
    List {
      Section {
        LabeledContent("Status") { Text(investment.status.capitalized) }
        LabeledContent("Monthly deposit") {
          MoneyText(amount: investment.monthlyDeposit ?? 0)
        }
        LabeledContent("Deposited so far") {
          MoneyText(amount: investment.currentValue)
        }
        if let rate = investment.interestRate {
          LabeledContent("Interest") {
            Text("\(Money.string(rate))% \(investment.interestType ?? "")")
          }
        }
        if let exit = investment.exitValue {
          LabeledContent("Exit value") { MoneyText(amount: exit) }
        }
        if !deposits.isEmpty {
          ProgressView(value: Double(paidCount), total: Double(deposits.count)) {
            Text("\(paidCount) of \(deposits.count) installments paid")
              .font(.caption)
          }
        }
        if let notes = investment.notes {
          Text(notes).font(.callout).foregroundStyle(.secondary)
        }
      }
      Section("Installments") {
        if deposits.isEmpty {
          Text("Schedule appears after first sync")
            .foregroundStyle(.secondary)
        }
        ForEach(deposits) { dep in
          HStack {
            VStack(alignment: .leading) {
              Text("#\(dep.installmentNumber ?? 0)")
              if let due = dep.dueDate {
                Text(dep.status == "paid" ? due.formatted(date: .abbreviated,
                                                          time: .omitted)
                     : dueLabel(daysUntil: utcDaysUntil(due, from: Date())))
                  .font(.caption)
                  .foregroundStyle(
                    dep.status != "paid" && utcDaysUntil(due, from: Date()) < 0
                      ? AnyShapeStyle(.red) : AnyShapeStyle(.secondary))
              }
            }
            Spacer()
            MoneyText(amount: dep.amount).font(.body.monospacedDigit())
            Image(systemName: dep.status == "paid"
                  ? "checkmark.circle.fill" : "circle")
              .foregroundStyle(dep.status == "paid" ? .green : .secondary)
          }
          .contentShape(.rect)
          .swipeActions {
            if investment.status == "active" || investment.status == "matured" {
              Button(dep.status == "paid" ? "Unpay" : "Paid") {
                try? Store(context: context).markDepositPaid(
                  dep, investment: investment, paid: dep.status != "paid")
                Task { await sync.syncNow() }
              }
              .tint(dep.status == "paid" ? .orange : .green)
            }
          }
        }
      }
      if investment.status == "active" {
        Section {
          Button("Close early", role: .destructive) { closing = true }
        }
      }
    }
    .navigationTitle(investment.name)
    .toolbar { Button("Edit") { editing = true } }
    .sheet(isPresented: $editing) { DpsEditSheet(investment: investment) }
    .sheet(isPresented: $closing) { DpsCloseSheet(investment: investment) }
  }
}

struct DpsEditSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var name = ""
  @State private var notes = ""

  var body: some View {
    NavigationStack {
      Form {
        TextField("Name", text: $name)
        TextField("Notes", text: $notes, axis: .vertical)
      }
      .navigationTitle("Edit DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            try? Store(context: context).updateDps(
              investment, name: Validate.name(name)!,
              notes: Validate.notes(notes)!)
            Task { await sync.syncNow() }
            dismiss()
          }
          .disabled(Validate.name(name) == nil || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        name = investment.name
        notes = investment.notes ?? ""
      }
    }
  }
}

struct DpsCloseSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var receivedAmount = ""
  @State private var closureDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Amount received", text: $receivedAmount)
            .keyboardType(.decimalPad)
          DatePicker("Closure date", selection: $closureDate,
                     displayedComponents: .date)
          TextField("Notes", text: $notes, axis: .vertical)
        } footer: {
          Text("Premature closure removes remaining installments. This can't be undone locally.")
        }
        if let error { Section { Text(error).foregroundStyle(.red) } }
      }
      .navigationTitle("Close DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Close DPS", role: .destructive) { submit() }
            .disabled(Validate.positiveMoney(receivedAmount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
  }

  private func submit() {
    do {
      try Store(context: context).closeDps(
        investment, receivedAmount: Validate.positiveMoney(receivedAmount)!,
        closureDate: closureDate, notes: Validate.notes(notes, max: 500)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
