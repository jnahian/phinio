import SwiftData
import SwiftUI

/// EMI create (emiCreateSchema) with a live schedule preview computed by the
/// local calculator — identical math to the server, so the preview equals
/// the persisted schedule.
struct EmiFormView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine

  @State private var label = ""
  @State private var type: EmiMethod = .bankLoan
  @State private var principal = ""
  @State private var interestRate = ""
  @State private var tenureMonths = 12
  @State private var startDate = Date()
  @State private var processingFee = ""
  @State private var notes = ""
  @State private var error: String?

  private var preview: [AmortizationRow]? {
    guard let p = Validate.positiveMoney(principal),
          let r = Validate.rate(interestRate) else { return nil }
    return try? EmiCalculator.amortization(
      principal: NSDecimalNumber(decimal: p).doubleValue,
      annualRate: NSDecimalNumber(decimal: r).doubleValue,
      tenureMonths: tenureMonths, startDate: startDate, type: type)
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          TextField("Label", text: $label)
          Picker("Type", selection: $type) {
            Text("Bank loan").tag(EmiMethod.bankLoan)
            Text("Credit card").tag(EmiMethod.creditCard)
          }
          TextField("Principal", text: $principal).keyboardType(.decimalPad)
          TextField("Interest rate (%)", text: $interestRate)
            .keyboardType(.decimalPad)
          Stepper("Tenure: \(tenureMonths) months", value: $tenureMonths,
                  in: 1...600)
          DatePicker("First payment", selection: $startDate,
                     displayedComponents: .date)
          TextField("Processing fee (optional)", text: $processingFee)
            .keyboardType(.decimalPad)
          TextField("Notes", text: $notes, axis: .vertical)
        }
        if let rows = preview, let first = rows.first {
          Section("Schedule preview") {
            LabeledContent("Monthly EMI") {
              MoneyText(amount: Money.decimal(first.emiAmount) ?? 0)
                .fontWeight(.semibold)
            }
            ForEach(rows.prefix(3), id: \.paymentNumber) { row in
              HStack {
                Text("#\(row.paymentNumber)")
                Text(row.dueDate, style: .date)
                  .font(.caption).foregroundStyle(.secondary)
                Spacer()
                MoneyText(amount: Money.decimal(row.emiAmount) ?? 0)
                  .font(.callout.monospacedDigit())
              }
            }
            if rows.count > 3 {
              Text("… and \(rows.count - 3) more")
                .font(.caption).foregroundStyle(.secondary)
            }
          }
          .listRowBackground(Color.clear.glassEffect(in: .rect(cornerRadius: 12)))
        }
        if let error { Section { Text(error).foregroundStyle(.red) } }
      }
      .navigationTitle("New EMI")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Save") { save() }.disabled(!isValid)
        }
      }
    }
  }

  private var isValid: Bool {
    Validate.name(label) != nil
      && Validate.positiveMoney(principal) != nil
      && Validate.rate(interestRate) != nil
      && Validate.notes(notes) != nil
      && (processingFee.trimmingCharacters(in: .whitespaces).isEmpty
          || Validate.nonNegativeMoney(processingFee) != nil)
  }

  private func save() {
    do {
      let feeText = processingFee.trimmingCharacters(in: .whitespaces)
      let fee = feeText.isEmpty ? nil : Validate.nonNegativeMoney(feeText)
      try Store(context: context).createEmi(
        label: Validate.name(label)!, type: type,
        principal: Validate.positiveMoney(principal)!,
        interestRate: Validate.rate(interestRate)!,
        tenureMonths: tenureMonths, startDate: startDate,
        notes: Validate.notes(notes)!,
        processingFee: (fee ?? 0) > 0 ? fee : nil)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
