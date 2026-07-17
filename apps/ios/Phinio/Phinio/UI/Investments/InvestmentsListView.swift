import SwiftData
import SwiftUI

struct InvestmentsListView: View {
  @Query(sort: \Investment.updatedAt, order: .reverse)
  private var investments: [Investment]
  @State private var showCompleted = false
  @State private var creating: CreateKind?

  enum CreateKind: String, Identifiable {
    case lumpSum, savings, dps
    var id: String { rawValue }
  }

  private var filtered: [Investment] {
    // Web filter: active = ['active']; completed = ['completed','matured','closed']
    investments.filter {
      showCompleted ? $0.status != "active" : $0.status == "active"
    }
  }

  private var grouped: [(type: String, items: [Investment])] {
    Dictionary(grouping: filtered, by: \.type)
      .map { (type: $0.key, items: $0.value) }
      .sorted { $0.type < $1.type }
  }

  var body: some View {
    List {
      Picker("Filter", selection: $showCompleted) {
        Text("Active").tag(false)
        Text("Completed").tag(true)
      }
      .pickerStyle(.segmented)
      .listRowBackground(Color.clear)

      ForEach(grouped, id: \.type) { group in
        Section(investmentTypeLabel(group.type)) {
          ForEach(group.items) { inv in
            NavigationLink(value: InvestmentRoute(id: inv.id)) {
              HStack {
                VStack(alignment: .leading) {
                  Text(inv.name)
                  Text(inv.status.capitalized)
                    .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                MoneyText(amount: inv.currentValue)
                  .font(.body.monospacedDigit())
              }
            }
          }
        }
      }
    }
    .overlay {
      if filtered.isEmpty {
        EmptyStateView(symbol: "banknote", title: "No investments",
          message: showCompleted ? "Nothing completed yet."
                                 : "Add your first investment.")
      }
    }
    .navigationTitle("Investments")
    .toolbar {
      Menu {
        Button("Lump sum") { creating = .lumpSum }
        Button("Savings") { creating = .savings }
        Button("DPS") { creating = .dps }
      } label: {
        Image(systemName: "plus")
      }
    }
    .sheet(item: $creating) { kind in
      switch kind {
      case .lumpSum: LumpSumFormView(existing: nil)
      case .savings: SavingsFormView(existing: nil)
      case .dps: DpsFormView()
      }
    }
  }
}

/// Detail dispatch by mode. Detail views take an id and re-query so a
/// deep link works and deletion pops gracefully.
struct InvestmentDetailRouter: View {
  let investmentId: String
  @Query private var matches: [Investment]

  init(investmentId: String) {
    self.investmentId = investmentId
    _matches = Query(filter: #Predicate<Investment> { $0.id == investmentId })
  }

  var body: some View {
    if let inv = matches.first {
      switch inv.mode {
      case "flexible": SavingsDetailView(investment: inv)
      case "scheduled": DpsDetailView(investment: inv)
      default: LumpSumDetailView(investment: inv)
      }
    } else {
      EmptyStateView(symbol: "questionmark.circle", title: "Not found",
        message: "This investment is no longer on this device.")
    }
  }
}

// Stubs — Task 8 / Task 9 replace these with real files.
struct SavingsDetailView: View {
  let investment: Investment
  var body: some View { Text(investment.name) }
}
struct SavingsFormView: View {
  let existing: Investment?
  var body: some View { Text("Savings form") }
}
struct DpsDetailView: View {
  let investment: Investment
  var body: some View { Text(investment.name) }
}
struct DpsFormView: View { var body: some View { Text("DPS form") } }
