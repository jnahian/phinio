import SwiftData
import SwiftUI

/// Withdraw from a lump-sum or savings investment. StoreError.validation
/// surfaces the server-identical guard messages inline.
struct WithdrawSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var amount = ""
  @State private var withdrawalDate = Date()
  @State private var notes = ""
  @State private var closeInvestment = false
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        Section {
          LabeledContent("Available") {
            MoneyText(amount: investment.currentValue)
              .monospacedDigit()
          }
          TextField("Amount", text: $amount).keyboardType(.decimalPad)
          DatePicker("Date", selection: $withdrawalDate,
                     displayedComponents: .date)
          TextField("Notes", text: $notes, axis: .vertical)
          Toggle("Close investment", isOn: $closeInvestment)
        } footer: {
          Text("Closing requires withdrawing the full current value.")
        }
        if let error {
          Section { Text(error).foregroundStyle(.red) }
        }
      }
      .navigationTitle("Withdraw")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Withdraw") { submit() }
            .disabled(Validate.positiveMoney(amount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
  }

  private func submit() {
    do {
      try Store(context: context).withdraw(
        from: investment, amount: Validate.positiveMoney(amount)!,
        withdrawalDate: withdrawalDate,
        notes: Validate.notes(notes, max: 500)!,
        closeInvestment: closeInvestment)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
