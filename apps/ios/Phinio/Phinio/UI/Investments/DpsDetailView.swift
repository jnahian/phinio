import SwiftData
import SwiftUI

struct DpsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @Query private var profiles: [Profile]
  @State private var editing = false
  @State private var closing = false
  @State private var confirmDelete = false
  @State private var error: String?

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.installmentNumber)])
  }

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var paidCount: Int { deposits.count { $0.status == "paid" } }
  private var tenure: Int { investment.tenureMonths ?? deposits.count }

  /// Maturity and interest come off the server-computed `accruedValue`; the
  /// schedule is server-generated, so deriving them here would mean
  /// re-implementing it. Nil until the first sync.
  private var maturity: Decimal? { deposits.last?.accruedValue }
  private var interestEarned: Decimal? {
    // Accrued through the leading contiguous paid run minus deposits over that
    // run — out-of-order paid installments don't advance the figure.
    let contiguousPaid = deposits.prefix { $0.status == "paid" }.count
    guard contiguousPaid > 0,
          let accrued = deposits[contiguousPaid - 1].accruedValue else { return nil }
    return max(0, accrued - Decimal(contiguousPaid) * (investment.monthlyDeposit ?? 0))
  }

  private var interestLine: String? {
    guard let rate = investment.interestRate else { return nil }
    let pct = rate.formatted(.number.precision(.fractionLength(0))) + "% p.a."
    guard let type = investment.interestType else { return pct }
    return "\(type.capitalized) · \(pct)"
  }

  var body: some View {
    List {
      Section {
        hero
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      Section {
        HStack(spacing: 10) {
          StatTile(
            label: "Monthly deposit",
            value: (investment.monthlyDeposit ?? 0).currencyCompact(currency))
          StatTile(
            label: "Maturity value",
            value: maturity?.currencyCompact(currency) ?? "—")
          StatTile(
            label: "Interest earned",
            value: interestEarned?.currencyCompact(currency) ?? "—")
        }
      }
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)

      if let interestLine {
        Section {
          LabeledContent("Interest") { Text(interestLine) }
        }
      }

      Section("Deposit schedule") {
        if let error {
          Text(error).font(.footnote).foregroundStyle(.red)
        }
        if deposits.isEmpty {
          Text("Schedule appears after first sync")
            .font(.subheadline).foregroundStyle(.secondary)
        }
        ForEach(deposits) { scheduleRow($0) }
      }
    }
    .navigationTitle(investment.name)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Menu {
          Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
          if investment.status == "active" {
            Button { closing = true } label: {
              Label("Close early", systemImage: "xmark.circle")
            }
          }
          Button(role: .destructive) { confirmDelete = true } label: {
            Label("Delete DPS scheme", systemImage: "trash")
          }
        } label: {
          Label("More", systemImage: "ellipsis.circle")
        }
      }
    }
    .sheet(isPresented: $editing) { DpsEditSheet(investment: investment) }
    .sheet(isPresented: $closing) { DpsCloseSheet(investment: investment) }
    .confirmationDialog(
      "Delete this scheme and its schedule?", isPresented: $confirmDelete,
      titleVisibility: .visible
    ) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }

  private var hero: some View {
    HeroCard(
      gradient: Gradients.dpsHero,
      orbTint: .white.opacity(0.14),
      radius: 20
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Total Deposited")
          .font(.caption.weight(.semibold)).textCase(.uppercase)
          .foregroundStyle(.white.opacity(0.72))
        Text(investment.investedAmount.currency(currency))
          .font(.largeTitle.weight(.bold).monospacedDigit())
          .foregroundStyle(.white)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        Text("\(paidCount) / \(tenure) months")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.white.opacity(0.75))
          .padding(.top, 14)
        // In-hero bar stays white-on-white — the tinted system bar would
        // vanish on the gradient.
        Capsule()
          .fill(.white.opacity(0.2))
          .frame(height: 6)
          .overlay(alignment: .leading) {
            GeometryReader { geo in
              Capsule()
                .fill(.white)
                .frame(width: geo.size.width * (tenure > 0 ? Double(paidCount) / Double(tenure) : 0))
            }
          }
          .padding(.top, 8)
      }
    }
  }

  private func scheduleRow(_ dep: InvestmentDeposit) -> some View {
    let paid = dep.status == "paid"
    let overdue = !paid && dep.dueDate.map { utcDaysUntil($0, from: Date()) < 0 } ?? false
    let canToggle = investment.status == "active" || investment.status == "matured"
    return Button {
      guard canToggle else { return }
      do {
        try Store(context: context).markDepositPaid(dep, investment: investment, paid: !paid)
        error = nil
        Task { await sync.syncNow() }
      } catch {
        self.error = error.localizedDescription
      }
    } label: {
      HStack(spacing: 12) {
        Text("\(dep.installmentNumber ?? 0)")
          .font(.caption.weight(.bold).monospacedDigit())
          .foregroundStyle(.secondary)
          .frame(width: 30, alignment: .leading)
        VStack(alignment: .leading, spacing: 2) {
          Text(dep.amount.currency(currency))
            .font(.body.monospacedDigit())
          Text(rowSubtitle(dep))
            .font(.caption)
            .foregroundStyle(overdue ? Color.red : Color.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        checkbox(paid)
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .disabled(!canToggle)
    .accessibilityLabel("Installment \(dep.installmentNumber ?? 0), \(dep.amount.currency(currency))")
    .accessibilityValue(paid ? "Paid" : overdue ? "Overdue" : "Upcoming")
  }

  private func rowSubtitle(_ dep: InvestmentDeposit) -> String {
    var parts: [String] = []
    if let due = dep.dueDate {
      parts.append(due.formatted(.dateTime.month(.abbreviated).year(.twoDigits)))
    }
    if let accrued = dep.accruedValue {
      parts.append("bal \(accrued.currencyCompact(currency))")
    }
    return parts.joined(separator: " · ")
  }

  private func checkbox(_ paid: Bool) -> some View {
    Image(systemName: paid ? "checkmark.circle.fill" : "circle")
      .font(.title3)
      .foregroundStyle(paid ? Color.green : Color(.separator))
      .accessibilityHidden(true)
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
    .presentationDetents([.medium, .large])
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
    .presentationDetents([.medium, .large])
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
