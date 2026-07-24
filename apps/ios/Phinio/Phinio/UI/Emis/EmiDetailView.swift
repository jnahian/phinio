import Charts
import SwiftData
import SwiftUI

/// The two halves of the principal-vs-interest donut, so the legend can focus one.
enum SplitSlice {
  case principal, interest

  var label: LocalizedStringKey {
    switch self {
    case .principal: "Principal"
    case .interest: "Interest"
    }
  }
}

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
  @State private var focusedSplit: SplitSlice?

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
        if let fee { feeRow(fee) }
        ForEach(schedule) { paymentRow($0) }
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

  private static let splitDonutSize: CGFloat = 110
  private static let splitDonutInnerRatio: CGFloat = 0.655

  /// See `DashboardView.donutLabelWidth` — an uncapped center label lays out at
  /// the chart's full width and spills onto the ring instead of scaling down.
  private static var splitLabelWidth: CGFloat {
    splitDonutSize * splitDonutInnerRatio - 10
  }

  private func splitRow(_ emi: Emi) -> some View {
    HStack(spacing: 20) {
      Chart {
        SectorMark(
          angle: .value("Principal", Double(truncating: NSDecimalNumber(decimal: emi.principal))),
          innerRadius: .ratio(Self.splitDonutInnerRatio), angularInset: 0
        )
        .foregroundStyle(Color.accentColor)
        .opacity(focusedSplit == nil || focusedSplit == .principal ? 1 : 0.25)
        SectorMark(
          angle: .value("Interest", Double(truncating: NSDecimalNumber(decimal: totalInterest))),
          innerRadius: .ratio(Self.splitDonutInnerRatio), angularInset: 0
        )
        .foregroundStyle(TypePalette.crypto)
        .opacity(focusedSplit == nil || focusedSplit == .interest ? 1 : 0.25)
      }
      .chartLegend(.hidden)
      .frame(width: Self.splitDonutSize, height: Self.splitDonutSize)
      .overlay {
        VStack(spacing: 2) {
          Text(focusedSplit?.label ?? "Total")
            .font(.caption2)
            .textCase(.uppercase)
            .foregroundStyle(.secondary)
            .lineLimit(1).minimumScaleFactor(0.6)
          Text(splitValue(emi).currencyCompact(currency))
            .font(.caption.weight(.bold).monospacedDigit())
            .lineLimit(1).minimumScaleFactor(0.5)
        }
        .frame(width: Self.splitLabelWidth)
        .contentTransition(.numericText())
      }
      .animation(.snappy, value: focusedSplit)
      .accessibilityHidden(true)  // the legend below states both figures

      VStack(alignment: .leading, spacing: 14) {
        splitLegend(.principal, emi.principal, Color.accentColor)
        splitLegend(.interest, totalInterest, TypePalette.crypto)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.vertical, 8)
  }

  private func splitValue(_ emi: Emi) -> Decimal {
    switch focusedSplit {
    case .principal: emi.principal
    case .interest: totalInterest
    case nil: emi.principal + totalInterest
    }
  }

  /// Same focus interaction as the dashboard allocation legend: tap to focus a
  /// slice, tap again to clear. `.borderless` because several buttons share one
  /// List row — under `.plain` the row swallows every tap.
  private func splitLegend(_ slice: SplitSlice, _ value: Decimal, _ tint: Color) -> some View {
    let focused = focusedSplit == slice
    return Button {
      focusedSplit = focused ? nil : slice
    } label: {
      VStack(alignment: .leading, spacing: 3) {
        HStack(spacing: 8) {
          RoundedRectangle(cornerRadius: 3, style: .continuous)
            .fill(tint).frame(width: 10, height: 10)
          Text(slice.label).font(.footnote).foregroundStyle(.secondary)
        }
        Text(value.currency(currency))
          .font(.headline.monospacedDigit())
          .foregroundStyle(.primary)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.leading, 18)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .contentShape(.rect)
      .opacity(focusedSplit == nil || focused ? 1 : 0.45)
    }
    .buttonStyle(.borderless)
    .accessibilityElement(children: .combine)
    .accessibilityAddTraits(focused ? [.isButton, .isSelected] : .isButton)
  }

  // MARK: Amortization

  /// Processing fee is `paymentNumber == 0` — shown, but never part of the
  /// paid/total counts or the progress figures.
  private func feeRow(_ fee: EmiPayment) -> some View {
    TransactionRow(
      symbol: "doc.text",
      tint: .secondary,
      title: Text("Processing fee"),
      amount: Text(verbatim: fee.emiAmount.currency(currency)),
      amountTint: .secondary)
  }

  /// The six-column table this replaced was unreadable at caption2; the same
  /// figures now ride the shared `TransactionRow` — principal/interest on the
  /// subtitle, remaining balance as the trailing caption.
  private func paymentRow(_ p: EmiPayment) -> some View {
    let paid = p.status == "paid"
    let overdue = !paid && utcDaysUntil(p.dueDate, from: Date()) < 0
    return Button {
      toggle(p)
    } label: {
      TransactionRow(
        symbol: paid ? "checkmark" : overdue ? "exclamationmark" : "calendar",
        tint: paid ? .green : overdue ? .red : .accentColor,
        title: Text("Payment \(p.paymentNumber)"),
        subtitle: Text(verbatim: rowSubtitle(p))
          .foregroundColor(overdue ? .red : nil),
        amount: Text(verbatim: p.emiAmount.currency(currency)),
        amountTint: paid ? .secondary : .primary,
        caption: Text(verbatim: "bal " + p.remainingBalance.currencyCompact(currency)))
        .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .animation(.snappy, value: paid)
    .accessibilityLabel("Payment \(p.paymentNumber), \(p.emiAmount.currency(currency))")
    .accessibilityValue(paid ? "Paid" : overdue ? "Overdue" : "Unpaid")
    .accessibilityHint("Double tap to mark \(paid ? "unpaid" : "paid")")
  }

  private func rowSubtitle(_ p: EmiPayment) -> String {
    let due = p.dueDate.formatted(.dateTime.month(.abbreviated).year(.twoDigits))
    return "\(due) · P \(p.principalComponent.currencyCompact(currency))"
      + " · I \(p.interestComponent.currencyCompact(currency))"
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
