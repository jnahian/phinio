import SwiftData
import SwiftUI

/// DPS create (dpsCreateSchema). The installment schedule is generated
/// server-side and arrives with the first snapshot after sync.
struct DpsFormView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var name = ""
  @State private var monthlyDeposit = ""
  @State private var tenureMonths = 12
  @State private var interestRate = ""
  @State private var interestType = "compound"
  @State private var startDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
          TextField("Monthly deposit", text: $monthlyDeposit)
            .keyboardType(.decimalPad)
          Stepper("Tenure: \(tenureMonths) months", value: $tenureMonths,
                  in: 1...600)
          TextField("Interest rate (%)", text: $interestRate)
            .keyboardType(.decimalPad)
          Picker("Interest type", selection: $interestType) {
            Text("Compound").tag("compound")
            Text("Simple").tag("simple")
          }
          DatePicker("Start date", selection: $startDate,
                     displayedComponents: .date)
          TextField("Notes", text: $notes, axis: .vertical)
        } footer: {
          Text("The installment schedule appears after the first sync.")
        }
        if let error { Section { Text(error).foregroundStyle(.red) } }
      }
      .navigationTitle("New DPS")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }
            .disabled(Validate.name(name) == nil
                      || Validate.positiveMoney(monthlyDeposit) == nil
                      || Validate.rate(interestRate) == nil
                      || Validate.notes(notes) == nil)
        }
      }
    }
  }

  private func save() {
    do {
      try Store(context: context).createDps(
        name: Validate.name(name)!,
        monthlyDeposit: Validate.positiveMoney(monthlyDeposit)!,
        tenureMonths: tenureMonths,
        interestRate: Validate.rate(interestRate)!,
        interestType: interestType, startDate: startDate,
        notes: Validate.notes(notes)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
