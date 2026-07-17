import SwiftData
import SwiftUI

/// Create + edit for lump-sum investments. Mirrors investmentCreateSchema /
/// investmentUpdateSchema: name, type enum, positive money amounts, dates.
struct LumpSumFormView: View {
  let existing: Investment?
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  static let types = ["stock", "mutual_fund", "fd", "gold", "crypto",
                      "sanchayapatra", "real_estate", "agro_farm",
                      "business", "other"]

  @State private var name = ""
  @State private var type = "stock"
  @State private var investedAmount = ""
  @State private var currentValue = ""
  @State private var dateOfInvestment = Date()
  @State private var hasClosureDate = false
  @State private var estimatedClosureDate = Date()
  @State private var notes = ""
  @State private var completed = false
  @State private var exitValue = ""
  @State private var completedAt = Date()
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
          Picker("Type", selection: $type) {
            ForEach(Self.types, id: \.self) { Text(investmentTypeLabel($0)) }
          }
          TextField("Invested amount", text: $investedAmount)
            .keyboardType(.decimalPad)
          TextField("Current value", text: $currentValue)
            .keyboardType(.decimalPad)
          DatePicker("Date of investment", selection: $dateOfInvestment,
                     displayedComponents: .date)
          Toggle("Estimated closure date", isOn: $hasClosureDate)
          if hasClosureDate {
            DatePicker("Closes on", selection: $estimatedClosureDate,
                       displayedComponents: .date)
          }
          TextField("Notes", text: $notes, axis: .vertical)
        }
        if existing != nil {
          Section("Completion") {
            Toggle("Completed", isOn: $completed)
            if completed {
              TextField("Exit value", text: $exitValue)
                .keyboardType(.decimalPad)
              DatePicker("Completed on", selection: $completedAt,
                         displayedComponents: .date)
            }
          }
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
      }
      .navigationTitle(existing == nil ? "New investment" : "Edit investment")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }.disabled(!isValid)
        }
      }
      .onAppear { populate() }
    }
  }

  private var isValid: Bool {
    Validate.name(name) != nil
      && Validate.positiveMoney(investedAmount) != nil
      && Validate.positiveMoney(currentValue) != nil
      && Validate.notes(notes) != nil
      && (!completed || Validate.positiveMoney(exitValue) != nil)
  }

  private func populate() {
    guard let inv = existing else { return }
    name = inv.name
    type = inv.type
    investedAmount = Money.string(inv.investedAmount)
    currentValue = Money.string(inv.currentValue)
    dateOfInvestment = inv.dateOfInvestment ?? Date()
    hasClosureDate = inv.estimatedClosureDate != nil
    estimatedClosureDate = inv.estimatedClosureDate ?? Date()
    notes = inv.notes ?? ""
    completed = inv.status == "completed"
    exitValue = inv.exitValue.map(Money.string) ?? ""
    completedAt = inv.completedAt ?? Date()
  }

  private func save() {
    do {
      let store = Store(context: context)
      let cleanName = Validate.name(name)!
      let cleanNotes = Validate.notes(notes)!
      let closure = hasClosureDate ? estimatedClosureDate : nil
      if let inv = existing {
        try store.updateLumpSumInvestment(inv,
          name: cleanName, type: type,
          investedAmount: Validate.positiveMoney(investedAmount)!,
          currentValue: Validate.positiveMoney(currentValue)!,
          dateOfInvestment: dateOfInvestment, estimatedClosureDate: closure,
          notes: cleanNotes, completed: completed,
          exitValue: completed ? Validate.positiveMoney(exitValue) : nil,
          completedAt: completed ? completedAt : nil)
      } else {
        try store.createLumpSumInvestment(
          name: cleanName, type: type,
          investedAmount: Validate.positiveMoney(investedAmount)!,
          currentValue: Validate.positiveMoney(currentValue)!,
          dateOfInvestment: dateOfInvestment, estimatedClosureDate: closure,
          notes: cleanNotes)
      }
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
