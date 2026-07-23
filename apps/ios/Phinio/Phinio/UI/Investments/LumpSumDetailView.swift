import SwiftData
import SwiftUI

struct LumpSumDetailView: View {
  let investment: Investment
  @Environment(\.modelContext) private var context
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var sync: SyncEngine
  @Query private var withdrawals: [InvestmentWithdrawal]
  @Query private var profiles: [Profile]
  @State private var editing = false
  @State private var withdrawing = false
  @State private var confirmDelete = false

  init(investment: Investment) {
    self.investment = investment
    let invId = investment.id
    _withdrawals = Query(
      filter: #Predicate<InvestmentWithdrawal> { $0.investmentId == invId },
      sort: [SortDescriptor(\.withdrawalDate, order: .reverse)])
  }

  private var currency: String { profiles.first?.preferredCurrency ?? "BDT" }
  private var value: Decimal { investment.exitValue ?? investment.currentValue }

  private var returnPercent: Decimal? {
    guard investment.investedAmount > 0 else { return nil }
    return (value - investment.investedAmount) / investment.investedAmount * 100
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        DetailHeader(
          title: investment.name,
          subtitle: investment.status.capitalized,
          onBack: { dismiss() }
        ) {
          TypeBadge(type: investment.type)
        }

        hero.padding(.horizontal, Layout.screenHorizontalPadding)

        HStack(spacing: 10) {
          StatTile(
            label: "Invested",
            value: investment.investedAmount.currencyCompact(currency),
            valueFont: .custom("Manrope-Bold", size: 15))
          StatTile(
            label: investment.exitValue == nil ? "Current" : "Exit value",
            value: value.currencyCompact(currency),
            valueFont: .custom("Manrope-Bold", size: 15))
          StatTile(
            label: "Type", value: investmentTypeLabel(investment.type),
            valueFont: .custom("Manrope-Bold", size: 15))
        }
        .padding(.top, 14)
        .padding(.horizontal, Layout.screenHorizontalPadding)

        if let date = investment.dateOfInvestment {
          detailRow("Invested on", date.formatted(.dateTime.day().month(.wide).year()))
        }
        if let closure = investment.estimatedClosureDate {
          detailRow("Estimated closure", closure.formatted(.dateTime.day().month(.wide).year()))
        }
        if let notes = investment.notes, !notes.isEmpty {
          detailRow("Notes", notes)
        }

        if !withdrawals.isEmpty {
          SectionHeader(title: "Withdrawals")
            .padding(.top, Layout.sectionGap)
            .padding(.horizontal, Layout.screenHorizontalPadding)
          withdrawalCard
            .padding(.top, 12)
            .padding(.horizontal, Layout.screenHorizontalPadding)
        }

        if investment.status == "active" {
          Button("Withdraw") { withdrawing = true }
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

        DangerButton("Delete investment") { confirmDelete = true }
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)
          .padding(.bottom, 40)
      }
    }
    .scrollIndicators(.hidden)
    .background(Color.surface)
    .toolbar(.hidden, for: .navigationBar)
    .sheet(isPresented: $editing) { LumpSumFormView(existing: investment) }
    .sheet(isPresented: $withdrawing) { WithdrawSheet(investment: investment) }
    .confirmationDialog(
      "Delete this investment?", isPresented: $confirmDelete, titleVisibility: .visible
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
      gradient: Gradients.netWorthHero,
      orbTint: Color.brandPrimary.opacity(0.18),
      radius: Radii.detailHero
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text(investment.exitValue == nil ? "Current Value" : "Exit Value")
          .font(.heroLabel).tracking(Tracking.heroLabel).textCase(.uppercase)
          .foregroundStyle(Color.onHero.opacity(0.72))
        Text(value.currency(currency))
          .font(.detailHeroNumeric).tracking(Tracking.detailHeroNumeric)
          .foregroundStyle(Color.onHero)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        HStack(spacing: 8) {
          if let pct = returnPercent { MoneyPill(percent: pct, size: .hero) }
          Button("Edit") { editing = true }
            .font(.rowLabel(13))
            .foregroundStyle(Color.onHero.opacity(0.8))
            .frame(minHeight: 44)
        }
        .padding(.top, 10)
      }
    }
  }

  private func detailRow(_ label: String, _ value: String) -> some View {
    HStack(alignment: .top, spacing: 12) {
      Text(label).font(.body).foregroundStyle(Color.onSurfaceVariant)
      Spacer(minLength: 12)
      Text(value)
        .font(.rowLabel(14)).foregroundStyle(Color.onSurface)
        .multilineTextAlignment(.trailing)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .background(
      Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
    .padding(.top, 12)
    .padding(.horizontal, Layout.screenHorizontalPadding)
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
