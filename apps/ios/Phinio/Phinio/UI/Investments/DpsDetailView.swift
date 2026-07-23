import SwiftData
import SwiftUI

struct DpsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @State private var editing = false
  @State private var closing = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.installmentNumber)])
  }

  @Environment(\.dismiss) private var dismiss
  @Query private var profiles: [Profile]
  @State private var confirmDelete = false

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var paidCount: Int { deposits.count { $0.status == "paid" } }
  private var tenure: Int { investment.tenureMonths ?? deposits.count }

  /// Maturity and interest come off the server-computed `accruedValue`; the
  /// schedule is server-generated, so deriving them here would mean
  /// re-implementing it. Nil until the first sync.
  private var maturity: Decimal? { deposits.last?.accruedValue }
  private var interestEarned: Decimal? {
    guard paidCount > 0, let accrued = deposits[paidCount - 1].accruedValue else { return nil }
    return max(0, accrued - investment.investedAmount)
  }

  private var subtitle: String {
    var parts = ["DPS"]
    if let type = investment.interestType { parts.append("\(type.capitalized) interest") }
    if let rate = investment.interestRate {
      parts.append(rate.formatted(.number.precision(.fractionLength(0))) + "% p.a.")
    }
    return parts.joined(separator: " · ")
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        DetailHeader(title: investment.name, subtitle: subtitle, onBack: { dismiss() }) {
          Button { editing = true } label: {
            Image(systemName: "pencil")
              .font(.system(size: 15))
              .foregroundStyle(Color.brandPrimary)
              .frame(width: 40, height: 40)
              .background(Color.brandPrimary.opacity(0.08), in: .circle)
              .contentShape(.circle)
          }
          .buttonStyle(.plain)
          .accessibilityLabel("Edit scheme")
        }

        hero.padding(.horizontal, Layout.screenHorizontalPadding)

        HStack(spacing: 10) {
          StatTile(
            label: "Monthly deposit",
            value: (investment.monthlyDeposit ?? 0).currencyCompact(currency),
            valueFont: .custom("Manrope-Bold", size: 15))
          StatTile(
            label: "Maturity value",
            value: maturity?.currencyCompact(currency) ?? "—",
            valueFont: .custom("Manrope-Bold", size: 15))
          StatTile(
            label: "Interest earned",
            value: interestEarned?.currencyCompact(currency) ?? "—",
            valueFont: .custom("Manrope-Bold", size: 15))
        }
        .padding(.top, 14)
        .padding(.horizontal, Layout.screenHorizontalPadding)

        SectionHeader(title: "Deposit Schedule")
          .padding(.top, Layout.sectionGap)
          .padding(.horizontal, Layout.screenHorizontalPadding)

        scheduleCard
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)

        if investment.status == "active" {
          Button("Close early") { closing = true }
            .font(.rowLabel(15))
            .foregroundStyle(Color.brandPrimary)
            .frame(maxWidth: .infinity)
            .padding(15)
            .background(
              Color.brandPrimary.opacity(0.10),
              in: RoundedRectangle(cornerRadius: Radii.tile, style: .continuous))
            .padding(.top, Layout.sectionGap)
            .padding(.horizontal, Layout.screenHorizontalPadding)
        }

        DangerButton("Delete DPS scheme") { confirmDelete = true }
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)
          .padding(.bottom, 40)
      }
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .toolbar(.hidden, for: .navigationBar)
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
      orbTint: Color.brandSecondary.opacity(0.22),
      radius: Radii.detailHero
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Total Deposited")
          .font(.heroLabel).tracking(Tracking.heroLabel).textCase(.uppercase)
          .foregroundStyle(Color.onHero.opacity(0.72))
        Text(investment.investedAmount.currency(currency))
          .font(.detailHeroNumeric).tracking(Tracking.detailHeroNumeric)
          .foregroundStyle(Color.onHero)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        Text("\(paidCount) / \(tenure) months")
          .font(.rowLabel(12))
          .foregroundStyle(Color.onHero.opacity(0.75))
          .padding(.top, 14)
        // In-hero bar is white-on-white per the comp, not the token progress bar.
        Capsule()
          .fill(Color.onHero.opacity(0.2))
          .frame(height: 6)
          .overlay(alignment: .leading) {
            GeometryReader { geo in
              Capsule()
                .fill(Color.onHero)
                .frame(width: geo.size.width * (tenure > 0 ? Double(paidCount) / Double(tenure) : 0))
            }
          }
          .padding(.top, 8)
      }
    }
  }

  private var scheduleCard: some View {
    VStack(spacing: 0) {
      if deposits.isEmpty {
        Text("Schedule appears after first sync")
          .font(.body).foregroundStyle(Color.onSurfaceVariant)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 24)
      }
      ForEach(deposits) { row($0) }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 6)
    .background(Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
  }

  private func row(_ dep: InvestmentDeposit) -> some View {
    let paid = dep.status == "paid"
    let overdue = !paid && dep.dueDate.map { utcDaysUntil($0, from: Date()) < 0 } ?? false
    let canToggle = investment.status == "active" || investment.status == "matured"
    return Button {
      guard canToggle else { return }
      try? Store(context: context).markDepositPaid(dep, investment: investment, paid: !paid)
      Task { await sync.syncNow() }
    } label: {
      HStack(spacing: 12) {
        Text("\(dep.installmentNumber ?? 0)")
          .font(.custom("Manrope-Bold", size: 12))
          .foregroundStyle(Color.onSurfaceMuted)
          .frame(width: 30, alignment: .leading)
        VStack(alignment: .leading, spacing: 2) {
          Text(dep.amount.currency(currency))
            .font(.rowLabel(13)).foregroundStyle(Color.onSurface)
          Text(rowSubtitle(dep))
            .font(.meta)
            .foregroundStyle(overdue ? Color.tertiaryFixedDim : Color.onSurfaceMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        checkbox(paid)
      }
      .padding(.horizontal, 8)
      .padding(.vertical, 12)
      .frame(minHeight: 44)
      .background(
        overdue
          ? Color.tertiaryFixedDim.opacity(0.10)
          : (paid ? .clear : Color.brandSecondary.opacity(0.06)),
        in: RoundedRectangle(cornerRadius: 11, style: .continuous))
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
    Group {
      if paid {
        RoundedRectangle(cornerRadius: 7, style: .continuous)
          .fill(Color.secondaryContainer)
          .frame(width: 22, height: 22)
          .overlay(
            Image(systemName: "checkmark")
              .font(.system(size: 12, weight: .bold))
              .foregroundStyle(Color.onHero))
      } else {
        RoundedRectangle(cornerRadius: 7, style: .continuous)
          .strokeBorder(Color.outlineVariant, lineWidth: 1.5)
          .frame(width: 22, height: 22)
      }
    }
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
