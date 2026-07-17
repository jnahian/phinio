import SwiftData
import SwiftUI

struct EmiDetailView: View {
  let emiId: String
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var matches: [Emi]
  @Query private var payments: [EmiPayment]
  @State private var editing = false
  @State private var confirmComplete = false
  @State private var confirmDelete = false
  @State private var error: String?

  init(emiId: String) {
    self.emiId = emiId
    _matches = Query(filter: #Predicate<Emi> { $0.id == emiId })
    _payments = Query(
      filter: #Predicate<EmiPayment> { $0.emiId == emiId },
      sort: [SortDescriptor(\.paymentNumber)])
  }

  private var emi: Emi? { matches.first }
  private var fee: EmiPayment? { payments.first { $0.paymentNumber == 0 } }
  private var schedule: [EmiPayment] { payments.filter { $0.paymentNumber > 0 } }
  private var paidCount: Int { schedule.filter { $0.status == "paid" }.count }

  var body: some View {
    if let emi {
      List {
        Section {
          LabeledContent("Status") { Text(emi.status.capitalized) }
          LabeledContent("Monthly EMI") { MoneyText(amount: emi.emiAmount) }
          LabeledContent("Principal") { MoneyText(amount: emi.principal) }
          LabeledContent("Interest") { Text("\(Money.string(emi.interestRate))%") }
          if let fee {
            LabeledContent("Processing fee") { MoneyText(amount: fee.emiAmount) }
          }
          ProgressView(value: Double(paidCount),
                       total: Double(max(schedule.count, 1))) {
            Text("\(paidCount) of \(schedule.count) payments made").font(.caption)
          }
          if let notes = emi.notes {
            Text(notes).font(.callout).foregroundStyle(.secondary)
          }
        }
        Section("Amortization") {
          ForEach(schedule) { p in
            VStack(alignment: .leading, spacing: 4) {
              HStack {
                Text("#\(p.paymentNumber)")
                Text(p.status == "paid"
                     ? p.dueDate.formatted(date: .abbreviated, time: .omitted)
                     : dueLabel(daysUntil: utcDaysUntil(p.dueDate, from: Date())))
                  .font(.caption)
                  .foregroundStyle(
                    p.status != "paid" && utcDaysUntil(p.dueDate, from: Date()) < 0
                      ? AnyShapeStyle(.red) : AnyShapeStyle(.secondary))
                Spacer()
                MoneyText(amount: p.emiAmount).font(.body.monospacedDigit())
                Image(systemName: p.status == "paid"
                      ? "checkmark.circle.fill" : "circle")
                  .foregroundStyle(p.status == "paid" ? .green : .secondary)
              }
              // ponytail: one interpolated Text — the plan's 6-way Text(…)+Text(…)
              // chain fails to type-check in reasonable time. Digits are the only
              // varying-width glyphs here, so monospacing the whole line is equivalent.
              Text(
                "Principal \(Money.string(p.principalComponent))"
                + " · Interest \(Money.string(p.interestComponent))"
                + " · Balance \(Money.string(p.remainingBalance))")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.tertiary)
            }
            .swipeActions {
              Button(p.status == "paid" ? "Unpay" : "Paid") {
                do {
                  try Store(context: context)
                    .markPaymentPaid(p, paid: p.status != "paid")
                  Task { await sync.syncNow() }
                } catch { self.error = error.localizedDescription }
              }
              .tint(p.status == "paid" ? .orange : .green)
            }
          }
        }
        if emi.status == "active" {
          Section {
            Button("Complete early") { confirmComplete = true }
          }
        }
        Section {
          Button("Delete EMI", role: .destructive) { confirmDelete = true }
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
      }
      .navigationTitle(emi.label)
      .toolbar { Button("Edit") { editing = true } }
      .sheet(isPresented: $editing) { EmiEditSheet(emi: emi) }
      .confirmationDialog("Mark all remaining payments as paid?",
                          isPresented: $confirmComplete,
                          titleVisibility: .visible) {
        Button("Complete EMI") {
          try? Store(context: context).completeEmi(emi)
          Task { await sync.syncNow() }
        }
      }
      .confirmationDialog("Delete this EMI and its schedule?",
                          isPresented: $confirmDelete,
                          titleVisibility: .visible) {
        Button("Delete", role: .destructive) {
          try? Store(context: context).deleteEmi(emi)
          Task { await sync.syncNow() }
          dismiss()
        }
      }
    } else {
      EmptyStateView(symbol: "questionmark.circle", title: "Not found",
        message: "This EMI is no longer on this device.")
    }
  }
}

struct EmiEditSheet: View {
  let emi: Emi
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var label = ""
  @State private var notes = ""

  var body: some View {
    NavigationStack {
      Form {
        TextField("Label", text: $label)
        TextField("Notes", text: $notes, axis: .vertical)
      }
      .navigationTitle("Edit EMI")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") {
            try? Store(context: context).updateEmi(
              emi, label: Validate.name(label)!, notes: Validate.notes(notes)!)
            Task { await sync.syncNow() }
            dismiss()
          }
          .disabled(Validate.name(label) == nil || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        label = emi.label
        notes = emi.notes ?? ""
      }
    }
  }
}
