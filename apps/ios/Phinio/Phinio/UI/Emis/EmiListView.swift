import SwiftData
import SwiftUI

struct EmiListView: View {
  @Query(sort: \Emi.updatedAt, order: .reverse) private var emis: [Emi]
  @Query private var payments: [EmiPayment]
  @State private var showCompleted = false

  private var filtered: [Emi] {
    emis.filter { showCompleted ? $0.status == "completed"
                                : $0.status == "active" }
  }

  private func progress(_ emi: Emi) -> (paid: Int, total: Int) {
    let rows = payments.filter { $0.emiId == emi.id && $0.paymentNumber > 0 }
    return (rows.filter { $0.status == "paid" }.count, rows.count)
  }

  var body: some View {
    List {
      Picker("Filter", selection: $showCompleted) {
        Text("Active").tag(false)
        Text("Completed").tag(true)
      }
      .pickerStyle(.segmented)
      .listRowBackground(Color.clear)

      ForEach(filtered) { emi in
        NavigationLink(value: EmiRoute(id: emi.id)) {
          VStack(alignment: .leading, spacing: 6) {
            HStack {
              Text(emi.label)
              Spacer()
              MoneyText(amount: emi.emiAmount).font(.body.monospacedDigit())
            }
            let p = progress(emi)
            ProgressView(value: Double(p.paid), total: Double(max(p.total, 1)))
            Text("\(p.paid)/\(p.total) paid · \(emi.type == "bank_loan" ? "Bank loan" : "Credit card")")
              .font(.caption).foregroundStyle(.secondary)
          }
        }
      }
    }
    .overlay {
      if filtered.isEmpty {
        EmptyStateView(symbol: "creditcard", title: "No EMIs",
          message: showCompleted ? "Nothing completed yet."
                                 : "Add your first EMI.")
      }
    }
    // Creation moved to the shell's global FAB (comp decision #4).
    .navigationTitle("EMIs")
  }
}
