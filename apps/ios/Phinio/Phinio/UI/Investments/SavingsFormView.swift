import SwiftData
import SwiftUI

/// Create + edit for flexible savings (savingsCreateSchema/savingsUpdateSchema).
struct SavingsFormView: View {
  let existing: Investment?
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var name = ""
  @State private var startDate = Date()
  @State private var currentValue = ""
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Name", text: $name)
          if existing == nil {
            DatePicker("Start date", selection: $startDate,
                       displayedComponents: .date)
          }
          TextField(existing == nil ? "Initial balance" : "Current value",
                    text: $currentValue)
            .keyboardType(.decimalPad)
          TextField("Notes", text: $notes, axis: .vertical)
        } footer: {
          if existing == nil {
            Text("An initial balance is recorded as your first deposit.")
          }
        }
        .noirFormRow()
        if let error {
          Section { Text(error).foregroundStyle(Color.error) }
        .noirFormRow()
        }
      }
      .noirForm()
      .navigationTitle(existing == nil ? "New savings" : "Edit savings")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }
            .disabled(Validate.name(name) == nil
                      || Validate.nonNegativeMoney(currentValue) == nil
                      || Validate.notes(notes) == nil)
        }
      }
      .onAppear {
        guard let inv = existing else { return }
        name = inv.name
        currentValue = Money.string(inv.currentValue)
        notes = inv.notes ?? ""
      }
    }
  }

  private func save() {
    do {
      let store = Store(context: context)
      if let inv = existing {
        try store.updateSavings(inv, name: Validate.name(name)!,
          currentValue: Validate.nonNegativeMoney(currentValue)!,
          notes: Validate.notes(notes)!)
      } else {
        try store.createSavings(name: Validate.name(name)!,
          startDate: startDate,
          currentValue: Validate.nonNegativeMoney(currentValue)!,
          notes: Validate.notes(notes)!)
      }
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
