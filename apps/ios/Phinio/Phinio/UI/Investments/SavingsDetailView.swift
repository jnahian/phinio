import SwiftData
import SwiftUI

struct SavingsDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var deposits: [InvestmentDeposit]
  @Query private var withdrawals: [InvestmentWithdrawal]
  @State private var editing = false
  @State private var addingDeposit = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _deposits = Query(
      filter: #Predicate<InvestmentDeposit> { $0.investmentId == invId },
      sort: [SortDescriptor(\.depositDate, order: .reverse)])
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  @Query private var profiles: [Profile]
  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    return (investment.currentValue - investment.investedAmount)
      / investment.investedAmount * 100
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        DetailHeader(
          title: investment.name, subtitle: "Savings pot", onBack: { dismiss() }
        ) {
          Button("Edit") { editing = true }
            .font(.rowLabel(13))
            .foregroundStyle(Color.brandPrimary)
            .frame(minWidth: 44, minHeight: 44)
        }

        hero.padding(.horizontal, Layout.screenHorizontalPadding)

        HStack(spacing: 10) {
          StatTile(
            label: "Total deposited",
            value: investment.investedAmount.currencyCompact(currency),
            alignment: .leading, valueFont: .custom("Manrope-Bold", size: 19))
          StatTile(
            label: "Deposits", value: "\(deposits.count)",
            alignment: .leading, valueFont: .custom("Manrope-Bold", size: 19))
        }
        .padding(.top, 14)
        .padding(.horizontal, Layout.screenHorizontalPadding)

        if investment.status == "active" {
          dashedButton("+ Add deposit") { addingDeposit = true }
            .padding(.top, 16)
            .padding(.horizontal, Layout.screenHorizontalPadding)
          dashedButton("Withdraw") { withdrawing = true }
            .padding(.top, 10)
            .padding(.horizontal, Layout.screenHorizontalPadding)
        }

        SectionHeader(title: "Deposit History")
          .padding(.top, Layout.sectionGap)
          .padding(.horizontal, Layout.screenHorizontalPadding)
        historyCard
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)

        if !withdrawals.isEmpty {
          SectionHeader(title: "Withdrawals")
            .padding(.top, Layout.sectionGap)
            .padding(.horizontal, Layout.screenHorizontalPadding)
          withdrawalCard
            .padding(.top, 12)
            .padding(.horizontal, Layout.screenHorizontalPadding)
        }

        DangerButton("Delete savings pot") { confirmDelete = true }
          .padding(.top, Layout.sectionGap)
          .padding(.horizontal, Layout.screenHorizontalPadding)
          .padding(.bottom, 40)
      }
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .toolbar(.hidden, for: .navigationBar)
    .sheet(isPresented: $editing) { SavingsFormView(existing: investment) }
    .sheet(isPresented: $addingDeposit) { AddDepositSheet(investment: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog("Delete this savings?", isPresented: $confirmDelete,
                        titleVisibility: .visible) {
      Button("Delete", role: .destructive) {
        try? Store(context: context).deleteInvestment(investment)
        Task { await sync.syncNow() }
        dismiss()
      }
    }
  }

  private var hero: some View {
    HeroCard(
      gradient: Gradients.savingsHero,
      orbTint: TypePalette.savings.opacity(0.22),
      radius: Radii.detailHero
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Current Balance")
          .font(.heroLabel).tracking(Tracking.heroLabel).textCase(.uppercase)
          .foregroundStyle(Color.onHero.opacity(0.72))
        Text(investment.currentValue.currency(currency))
          .font(.detailHeroNumeric).tracking(Tracking.detailHeroNumeric)
          .foregroundStyle(Color.onHero)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        if let pct = returnPercent, !deposits.isEmpty {
          MoneyPill(percent: pct, size: .hero).padding(.top, 12)
        }
      }
    }
  }

  /// Comp draws the add-deposit affordance as a dashed outline, not a filled
  /// button — it reads as "slot to fill" rather than a primary action.
  private func dashedButton(_ title: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(title)
        .font(.rowLabel(14))
        .foregroundStyle(Color.brandPrimary)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 15)
        .background(
          RoundedRectangle(cornerRadius: Radii.tile, style: .continuous)
            .strokeBorder(
              Color.outlineVariant,
              style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])))
    }
    .buttonStyle(.plain)
  }

  private var historyCard: some View {
    SectionGroup {
      VStack(spacing: 0) {
        if deposits.isEmpty {
          Text("No deposits yet")
            .font(.body).foregroundStyle(Color.onSurfaceVariant)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
        }
        ForEach(deposits) { dep in
          HStack(spacing: 12) {
            IconTile(size: 38, radius: Radii.iconTile,
                     background: Color.brandSecondary.opacity(0.12)) {
              Image(systemName: "arrow.down")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.brandSecondary)
            }
            VStack(alignment: .leading, spacing: 2) {
              Text(dep.notes ?? "Deposit")
                .font(.rowLabel(14)).foregroundStyle(Color.onSurface).lineLimit(1)
              if let d = dep.depositDate {
                Text(d, format: .dateTime.day().month(.abbreviated).year())
                  .font(.meta).foregroundStyle(Color.onSurfaceMuted)
              }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("+ " + dep.amount.currency(currency))
              .font(.amount).foregroundStyle(Color.brandSecondary)
              .lineLimit(1).minimumScaleFactor(0.6)
          }
          .padding(.horizontal, 16)
          .padding(.vertical, 14)
          .contentShape(.rect)
          .swipeActions {
            if investment.status == "active" {
              Button("Remove", role: .destructive) {
                try? Store(context: context).removeDeposit(dep, from: investment)
                Task { await sync.syncNow() }
              }
            }
          }
        }
      }
      .padding(.vertical, 6)
    }
  }

  private var withdrawalCard: some View {
    SectionGroup {
      VStack(spacing: 0) {
        ForEach(withdrawals) { w in
          HStack(spacing: 12) {
            IconTile(size: 38, radius: Radii.iconTile,
                     background: Color.tertiaryContainer.opacity(0.12)) {
              Image(systemName: "arrow.up")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.tertiaryFixedDim)
            }
            VStack(alignment: .leading, spacing: 2) {
              Text(w.notes ?? "Withdrawal")
                .font(.rowLabel(14)).foregroundStyle(Color.onSurface).lineLimit(1)
              Text(w.withdrawalDate, format: .dateTime.day().month(.abbreviated).year())
                .font(.meta).foregroundStyle(Color.onSurfaceMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("− " + w.amount.currency(currency))
              .font(.amount).foregroundStyle(Color.tertiaryFixedDim)
              .lineLimit(1).minimumScaleFactor(0.6)
          }
          .padding(.horizontal, 16)
          .padding(.vertical, 14)
        }
      }
      .padding(.vertical, 6)
    }
  }
}

struct AddDepositSheet: View {
  let investment: Investment
  @Environment(\.dismiss) private var dismiss
  @Environment(\.modelContext) private var context
  @EnvironmentObject private var sync: SyncEngine
  @State private var amount = ""
  @State private var depositDate = Date()
  @State private var notes = ""
  @State private var error: String?

  var body: some View {
    NavigationStack {
      Form {
        TextField("Amount", text: $amount).keyboardType(.decimalPad)
        DatePicker("Date", selection: $depositDate, displayedComponents: .date)
        TextField("Notes", text: $notes, axis: .vertical)
        if let error { Text(error).foregroundStyle(.red) }
      }
      .navigationTitle("Add deposit")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button("Add") { submit() }
            .disabled(Validate.positiveMoney(amount) == nil
                      || Validate.notes(notes, max: 500) == nil)
        }
      }
    }
  }

  private func submit() {
    do {
      try Store(context: context).addDeposit(
        to: investment, amount: Validate.positiveMoney(amount)!,
        depositDate: depositDate, notes: Validate.notes(notes, max: 500)!)
      Task { await sync.syncNow() }
      dismiss()
    } catch {
      self.error = error.localizedDescription
    }
  }
}
