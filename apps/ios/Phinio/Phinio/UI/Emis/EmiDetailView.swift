import Charts
import SwiftData
import SwiftUI

struct EmiDetailView: View {
  let emiId: String
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var matches: [Emi]
  @Query private var payments: [EmiPayment]
  @Query private var profiles: [Profile]
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

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var fee: EmiPayment? { payments.first { $0.paymentNumber == 0 } }
  private var schedule: [EmiPayment] { payments.filter { $0.paymentNumber > 0 } }
  private var paidCount: Int { schedule.count { $0.status == "paid" } }

  /// Lifetime split, from the stored schedule rather than a re-derivation.
  private var totalInterest: Decimal { schedule.reduce(0) { $0 + $1.interestComponent } }
  private var interestPaid: Decimal {
    schedule.filter { $0.status == "paid" }.reduce(0) { $0 + $1.interestComponent }
  }
  private var remainingBalance: Decimal {
    schedule.first { $0.status != "paid" }?.remainingBalance ?? 0
  }

  var body: some View {
    if let emi {
      content(emi)
        .navigationTitle(emi.label)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .topBarTrailing) {
            Menu {
              Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
              if emi.status == "active" {
                Button { confirmComplete = true } label: {
                  Label("Complete early", systemImage: "checkmark.circle")
                }
              }
              Button(role: .destructive) { confirmDelete = true } label: {
                Label("Delete EMI", systemImage: "trash")
              }
            } label: {
              Label("More", systemImage: "ellipsis.circle")
            }
          }
        }
        .sheet(isPresented: $editing) { EmiEditSheet(emi: emi) }
        .confirmationDialog(
          "Mark all remaining payments as paid?", isPresented: $confirmComplete,
          titleVisibility: .visible
        ) {
          Button("Complete EMI") {
            do {
              try Store(context: context).completeEmi(emi)
              error = nil
              Task { await sync.syncNow() }
            } catch {
              self.error = error.localizedDescription
            }
          }
        }
        .confirmationDialog(
          "Delete this EMI and its schedule?", isPresented: $confirmDelete,
          titleVisibility: .visible
        ) {
          Button("Delete", role: .destructive) {
            try? Store(context: context).deleteEmi(emi)
            Task { await sync.syncNow() }
            dismiss()
          }
        }
    } else {
      ContentUnavailableView(
        "Not found", systemImage: "questionmark.circle",
        description: Text("This EMI is no longer on this device."))
    }
  }

  private var emi: Emi? { matches.first }

  private func content(_ emi: Emi) -> some View {
    let isLoan = emi.type == "bank_loan"
    return List {
      Section {
        hero(emi, isLoan: isLoan)
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        HStack(spacing: 10) {
          StatTile(label: "Paid months", value: "\(paidCount) / \(schedule.count)")
          StatTile(label: "Remaining", value: "\(schedule.count - paidCount)")
          StatTile(label: "Interest paid", value: interestPaid.currencyCompact(currency))
        }
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section("Principal vs interest") {
        splitRow(emi)
      }

      Section("Amortization schedule") {
        if let error {
          Text(error).font(.footnote).foregroundStyle(.red)
        }
        columnHeader
        if let fee { feeRow(fee) }
        ForEach(schedule) { p in
          paymentRow(p)
            .listRowBackground(rowBackground(
              paid: p.status == "paid",
              overdue: p.status != "paid" && utcDaysUntil(p.dueDate, from: Date()) < 0))
        }
      }
    }
  }

  private func hero(_ emi: Emi, isLoan: Bool) -> some View {
    HeroCard(
      gradient: isLoan ? Gradients.emiLoanHero : Gradients.emiCardHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text(isLoan ? "Bank Loan · Remaining Balance" : "Credit Card · Remaining Balance")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.7))
        Text(remainingBalance.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        Text(emi.emiAmount.currency(currency) + "/mo")
          .font(.footnote.weight(.semibold).monospacedDigit())
          .foregroundStyle(.white.opacity(0.7))
          .padding(.top, 10)
      }
    }
  }

  private func splitRow(_ emi: Emi) -> some View {
    HStack(spacing: 20) {
      Chart {
        SectorMark(
          angle: .value("Principal", Double(truncating: NSDecimalNumber(decimal: emi.principal))),
          innerRadius: .ratio(0.655), angularInset: 0
        )
        .foregroundStyle(Color.accentColor)
        SectorMark(
          angle: .value("Interest", Double(truncating: NSDecimalNumber(decimal: totalInterest))),
          innerRadius: .ratio(0.655), angularInset: 0
        )
        .foregroundStyle(TypePalette.crypto)
      }
      .chartLegend(.hidden)
      .frame(width: 110, height: 110)
      .overlay {
        VStack(spacing: 2) {
          Text("Total")
            .font(.caption2)
            .textCase(.uppercase)
            .foregroundStyle(.secondary)
          Text((emi.principal + totalInterest).currencyCompact(currency))
            .font(.caption.weight(.bold).monospacedDigit())
            .lineLimit(1).minimumScaleFactor(0.5)
        }
        .padding(.horizontal, 10)
      }
      .accessibilityHidden(true)  // the legend below states both figures

      VStack(alignment: .leading, spacing: 14) {
        splitLegend("Principal", emi.principal, Color.accentColor)
        splitLegend("Interest", totalInterest, TypePalette.crypto)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.vertical, 8)
  }

  private func splitLegend(_ label: LocalizedStringKey, _ value: Decimal, _ tint: Color) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 8) {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(tint).frame(width: 10, height: 10)
        Text(label).font(.footnote).foregroundStyle(.secondary)
      }
      Text(value.currency(currency))
        .font(.headline.monospacedDigit())
        .lineLimit(1).minimumScaleFactor(0.6)
        .padding(.leading, 18)
    }
    .accessibilityElement(children: .combine)
  }

  // MARK: Amortization

  private var columnHeader: some View {
    HStack(spacing: 4) {
      Text("#").frame(width: 22, alignment: .leading)
      Text("Due").frame(width: 40, alignment: .leading)
      Text("EMI").frame(maxWidth: .infinity, alignment: .trailing)
      Text("Prin.").frame(maxWidth: .infinity, alignment: .trailing)
      Text("Int.").frame(maxWidth: .infinity, alignment: .trailing)
      Text("Bal.").frame(maxWidth: .infinity, alignment: .trailing)
      Color.clear.frame(width: 26)
    }
    .font(.caption2.weight(.semibold))
    .textCase(.uppercase)
    .foregroundStyle(.secondary)
  }

  /// Processing fee is `paymentNumber == 0` — shown, but never part of the
  /// paid/total counts or the progress figures.
  private func feeRow(_ fee: EmiPayment) -> some View {
    HStack(spacing: 4) {
      Text("—").frame(width: 22, alignment: .leading)
      Text("Fee").frame(width: 40, alignment: .leading)
      Text(fee.emiAmount.currencyCompact(currency))
        .frame(maxWidth: .infinity, alignment: .trailing)
      Text("—").frame(maxWidth: .infinity, alignment: .trailing)
      Text("—").frame(maxWidth: .infinity, alignment: .trailing)
      Text("—").frame(maxWidth: .infinity, alignment: .trailing)
      Color.clear.frame(width: 26)
    }
    .font(.caption2.monospacedDigit())
    .foregroundStyle(.secondary)
  }

  private func paymentRow(_ p: EmiPayment) -> some View {
    let paid = p.status == "paid"
    let overdue = !paid && utcDaysUntil(p.dueDate, from: Date()) < 0
    return Button {
      toggle(p)
    } label: {
      HStack(spacing: 4) {
        Text("\(p.paymentNumber)").frame(width: 22, alignment: .leading)
        Text(p.dueDate, format: .dateTime.month(.abbreviated).year(.twoDigits))
          .frame(width: 40, alignment: .leading)
        Text(p.emiAmount.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Text(p.principalComponent.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Text(p.interestComponent.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Text(p.remainingBalance.currencyCompact(currency))
          .frame(maxWidth: .infinity, alignment: .trailing)
        Image(systemName: paid ? "checkmark.circle.fill" : "circle")
          .font(.subheadline)
          .foregroundStyle(paid ? Color.green : Color(.separator))
          .frame(width: 26, alignment: .trailing)
          .accessibilityHidden(true)
      }
      .font(.caption2.monospacedDigit())
      .foregroundStyle(paid ? Color.secondary : Color.primary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Payment \(p.paymentNumber), \(p.emiAmount.currency(currency))")
    .accessibilityValue(paid ? "Paid" : overdue ? "Overdue" : "Unpaid")
    .accessibilityHint("Double tap to mark \(paid ? "unpaid" : "paid")")
  }

  @ViewBuilder
  private func rowBackground(paid: Bool, overdue: Bool) -> some View {
    ZStack {
      Color(.secondarySystemGroupedBackground)
      if overdue {
        Color.red.opacity(0.08)
      } else if !paid {
        Color.accentColor.opacity(0.05)
      }
    }
  }

  /// Optimistic — Store writes locally and enqueues the mutation; a failed
  /// write surfaces inline rather than silently dropping.
  private func toggle(_ p: EmiPayment) {
    do {
      try Store(context: context).markPaymentPaid(p, paid: p.status != "paid")
      error = nil
      Task { await sync.syncNow() }
    } catch {
      self.error = error.localizedDescription
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
    .presentationDetents([.medium, .large])
  }
}
