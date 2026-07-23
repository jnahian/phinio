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
        .background(Color.surface)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $editing) { EmiEditSheet(emi: emi) }
        .confirmationDialog(
          "Mark all remaining payments as paid?", isPresented: $confirmComplete,
          titleVisibility: .visible
        ) {
          Button("Complete EMI") {
            try? Store(context: context).completeEmi(emi)
            Task { await sync.syncNow() }
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
      NoirEmptyState(
        title: "Not found", message: "This EMI is no longer on this device.")
    }
  }

  private var emi: Emi? { matches.first }

  private func content(_ emi: Emi) -> some View {
    let isLoan = emi.type == "bank_loan"
    return ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        DetailHeader(title: emi.label, onBack: { dismiss() }) {
          Text(isLoan ? "Bank Loan" : "Credit Card")
            .font(.badgeLabel)
            .foregroundStyle(isLoan ? Color.brandPrimary : TypePalette.crypto)
            .padding(.horizontal, 11)
            .padding(.vertical, 5)
            .background(
              (isLoan ? Color.brandPrimary : TypePalette.crypto).opacity(0.16),
              in: .capsule)
            .fixedSize()
        }

        hero(emi, isLoan: isLoan)
          .padding(.horizontal, Layout.screenHorizontalPadding)

        tiles(emi).padding(.top, 14)

        SectionHeader(title: "Principal vs Interest")
          .padding(.top, Layout.sectionGap)
          .padding(.horizontal, Layout.screenHorizontalPadding)
        splitCard(emi)
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)

        SectionHeader(title: "Amortization Schedule")
          .padding(.top, Layout.sectionGap)
          .padding(.horizontal, Layout.screenHorizontalPadding)
        scheduleTable
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)

        if let error {
          Text(error).font(.caption).foregroundStyle(Color.error)
            .padding(.top, 12)
            .padding(.horizontal, Layout.screenHorizontalPadding)
        }

        if emi.status == "active" {
          Button("Complete early") { confirmComplete = true }
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

        DangerButton("Delete EMI") { confirmDelete = true }
          .padding(.top, 12)
          .padding(.horizontal, Layout.screenHorizontalPadding)
          .padding(.bottom, 40)
      }
    }
    .scrollIndicators(.hidden)
  }

  private func hero(_ emi: Emi, isLoan: Bool) -> some View {
    HeroCard(
      gradient: isLoan ? Gradients.emiLoanHero : Gradients.emiCardHero,
      orbTint: Color.onHero.opacity(0.14),
      radius: Radii.detailHero
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text("Remaining Balance")
          .font(.heroLabel).tracking(Tracking.heroLabel).textCase(.uppercase)
          .foregroundStyle(Color.onHero.opacity(0.7))
        Text(remainingBalance.currency(currency))
          .font(.detailHeroNumeric).tracking(Tracking.detailHeroNumeric)
          .foregroundStyle(Color.onHero)
          .lineLimit(1).minimumScaleFactor(0.6)
          .padding(.top, 8)
        Text(emi.emiAmount.currency(currency) + "/mo")
          .font(.rowLabel(13))
          .foregroundStyle(Color.onHero.opacity(0.7))
          .padding(.top, 10)
      }
    }
  }

  private func tiles(_ emi: Emi) -> some View {
    HStack(spacing: 10) {
      StatTile(label: "Paid months", value: "\(paidCount) / \(schedule.count)")
      StatTile(label: "Remaining", value: "\(schedule.count - paidCount)")
      StatTile(label: "Interest paid", value: interestPaid.currencyCompact(currency))
    }
    .padding(.horizontal, Layout.screenHorizontalPadding)
  }

  private func splitCard(_ emi: Emi) -> some View {
    HStack(spacing: 20) {
      Chart {
        SectorMark(
          angle: .value("Principal", Double(truncating: NSDecimalNumber(decimal: emi.principal))),
          innerRadius: .ratio(0.655), angularInset: 0
        )
        .foregroundStyle(Color.primaryContainer)
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
          Text("TOTAL")
            .font(.custom("Inter-SemiBold", size: 8))
            .tracking(0.8)
            .foregroundStyle(Color.onSurfaceMuted)
          Text((emi.principal + totalInterest).currencyCompact(currency))
            .font(.custom("Manrope-ExtraBold", size: 12))
            .foregroundStyle(Color.onSurface)
            .lineLimit(1).minimumScaleFactor(0.5)
        }
        .padding(.horizontal, 10)
      }
      .accessibilityHidden(true)  // the legend below states both figures

      VStack(alignment: .leading, spacing: 14) {
        splitLegend("Principal", emi.principal, Color.primaryContainer)
        splitLegend("Interest", totalInterest, TypePalette.crypto)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(18)
    .background(Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
  }

  private func splitLegend(_ label: String, _ value: Decimal, _ tint: Color) -> some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 8) {
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(tint).frame(width: 10, height: 10)
        Text(label).font(.caption).foregroundStyle(Color.onSurfaceVariant)
      }
      Text(value.currency(currency))
        .font(.cardTitle).foregroundStyle(Color.onSurface)
        .lineLimit(1).minimumScaleFactor(0.6)
        .padding(.leading, 18)
    }
    .accessibilityElement(children: .combine)
  }

  // MARK: Amortization

  private var scheduleTable: some View {
    VStack(spacing: 0) {
      HStack(spacing: 4) {
        tableCell("#", width: 22, align: .leading)
        tableCell("Due", width: 40, align: .leading)
        tableCell("EMI", width: nil, align: .trailing)
        tableCell("Prin.", width: nil, align: .trailing)
        tableCell("Int.", width: nil, align: .trailing)
        tableCell("Bal.", width: nil, align: .trailing)
        Color.clear.frame(width: 26)
      }
      .font(.custom("Inter-SemiBold", size: 9.5))
      .tracking(0.4)
      .textCase(.uppercase)
      .foregroundStyle(Color.onSurfaceFaint)
      .padding(.horizontal, 6)
      .padding(.top, 10)
      .padding(.bottom, 8)

      if let fee {
        feeRow(fee)
      }
      ForEach(schedule) { row($0) }
    }
    .padding(.horizontal, 10)
    .padding(.bottom, 10)
    .background(Color.surfaceLow, in: RoundedRectangle(cornerRadius: Radii.card, style: .continuous))
  }

  @ViewBuilder
  private func tableCell(_ text: String, width: CGFloat?, align: Alignment) -> some View {
    if let width {
      Text(text).frame(width: width, alignment: align)
    } else {
      Text(text).frame(maxWidth: .infinity, alignment: align)
    }
  }

  /// Processing fee is `paymentNumber == 0` — shown, but never part of the
  /// paid/total counts or the progress bar.
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
    .font(.tableRow)
    .foregroundStyle(Color.onSurfaceFaint)
    .padding(.horizontal, 6)
    .padding(.vertical, 9)
  }

  private func row(_ p: EmiPayment) -> some View {
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
        checkbox(paid).frame(width: 26, alignment: .trailing)
      }
      .font(.tableRow)
      .foregroundStyle(paid ? Color.onSurfaceFaint : Color.onSurface)
      .padding(.horizontal, 6)
      .padding(.vertical, 9)
      .frame(minHeight: 44)
      .background(
        rowBackground(paid: paid, overdue: overdue),
        in: RoundedRectangle(cornerRadius: 9, style: .continuous))
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Payment \(p.paymentNumber), \(p.emiAmount.currency(currency))")
    .accessibilityValue(paid ? "Paid" : overdue ? "Overdue" : "Unpaid")
    .accessibilityHint("Double tap to mark \(paid ? "unpaid" : "paid")")
  }

  private func rowBackground(paid: Bool, overdue: Bool) -> Color {
    if overdue { return Color.tertiaryFixedDim.opacity(0.10) }
    return paid ? .clear : Color.primaryContainer.opacity(0.06)
  }

  private func checkbox(_ paid: Bool) -> some View {
    Group {
      if paid {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
          .fill(Color.secondaryContainer)
          .frame(width: 18, height: 18)
          .overlay(
            Image(systemName: "checkmark")
              .font(.system(size: 10, weight: .bold))
              .foregroundStyle(Color.onHero))
      } else {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
          .strokeBorder(Color.outlineVariant, lineWidth: 1.5)
          .frame(width: 18, height: 18)
      }
    }
    .accessibilityHidden(true)
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
      .noirForm()
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
  }
}
