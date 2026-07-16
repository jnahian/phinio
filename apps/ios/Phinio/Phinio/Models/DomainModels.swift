import Foundation
import SwiftData

/// Mirrors of the Prisma domain models (prisma/schema.prisma). Ids are the
/// server's lowercase UUID strings; money is Decimal (strings on the wire).
/// Cross-model links are by id, not @Relationship — snapshot sync replaces
/// tables wholesale and by-id mirrors the wire shapes exactly.
/// ponytail: by-id joins; add @Relationship if Plan 3 list queries get awkward.

@Model
final class Profile {
  @Attribute(.unique) var id: String
  var fullName: String
  var preferredCurrency: String
  var preferredLanguage: String
  var updatedAt: Date

  init(id: String, fullName: String, preferredCurrency: String,
       preferredLanguage: String, updatedAt: Date) {
    self.id = id
    self.fullName = fullName
    self.preferredCurrency = preferredCurrency
    self.preferredLanguage = preferredLanguage
    self.updatedAt = updatedAt
  }
}

@Model
final class Investment {
  @Attribute(.unique) var id: String
  var name: String
  var type: String
  var mode: String // lump_sum | scheduled | flexible
  var status: String
  var investedAmount: Decimal
  var currentValue: Decimal
  var exitValue: Decimal?
  var dateOfInvestment: Date?
  var startDate: Date?
  var monthlyDeposit: Decimal?
  var tenureMonths: Int?
  var interestRate: Decimal?
  var interestType: String?
  var estimatedClosureDate: Date?
  var completedAt: Date?
  var notes: String?
  var updatedAt: Date

  init(id: String, name: String, type: String, mode: String, status: String,
       investedAmount: Decimal, currentValue: Decimal, exitValue: Decimal?,
       dateOfInvestment: Date?, startDate: Date?, monthlyDeposit: Decimal?,
       tenureMonths: Int?, interestRate: Decimal?, interestType: String?,
       estimatedClosureDate: Date?, completedAt: Date?, notes: String?,
       updatedAt: Date) {
    self.id = id
    self.name = name
    self.type = type
    self.mode = mode
    self.status = status
    self.investedAmount = investedAmount
    self.currentValue = currentValue
    self.exitValue = exitValue
    self.dateOfInvestment = dateOfInvestment
    self.startDate = startDate
    self.monthlyDeposit = monthlyDeposit
    self.tenureMonths = tenureMonths
    self.interestRate = interestRate
    self.interestType = interestType
    self.estimatedClosureDate = estimatedClosureDate
    self.completedAt = completedAt
    self.notes = notes
    self.updatedAt = updatedAt
  }
}

@Model
final class InvestmentDeposit {
  @Attribute(.unique) var id: String
  var investmentId: String
  var amount: Decimal
  var dueDate: Date?
  var depositDate: Date?
  var installmentNumber: Int?
  var status: String
  var notes: String?
  var updatedAt: Date

  init(id: String, investmentId: String, amount: Decimal, dueDate: Date?,
       depositDate: Date?, installmentNumber: Int?, status: String,
       notes: String?, updatedAt: Date) {
    self.id = id
    self.investmentId = investmentId
    self.amount = amount
    self.dueDate = dueDate
    self.depositDate = depositDate
    self.installmentNumber = installmentNumber
    self.status = status
    self.notes = notes
    self.updatedAt = updatedAt
  }
}

@Model
final class InvestmentWithdrawal {
  @Attribute(.unique) var id: String
  var investmentId: String
  var amount: Decimal
  var withdrawalDate: Date
  var notes: String?

  init(id: String, investmentId: String, amount: Decimal,
       withdrawalDate: Date, notes: String?) {
    self.id = id
    self.investmentId = investmentId
    self.amount = amount
    self.withdrawalDate = withdrawalDate
    self.notes = notes
  }
}

@Model
final class Emi {
  @Attribute(.unique) var id: String
  var label: String
  var type: String
  var principal: Decimal
  var interestRate: Decimal
  var tenureMonths: Int
  var emiAmount: Decimal
  var startDate: Date
  var status: String
  var notes: String?
  var updatedAt: Date

  init(id: String, label: String, type: String, principal: Decimal,
       interestRate: Decimal, tenureMonths: Int, emiAmount: Decimal,
       startDate: Date, status: String, notes: String?, updatedAt: Date) {
    self.id = id
    self.label = label
    self.type = type
    self.principal = principal
    self.interestRate = interestRate
    self.tenureMonths = tenureMonths
    self.emiAmount = emiAmount
    self.startDate = startDate
    self.status = status
    self.notes = notes
    self.updatedAt = updatedAt
  }
}

@Model
final class EmiPayment {
  @Attribute(.unique) var id: String
  var emiId: String
  var paymentNumber: Int
  var dueDate: Date
  var emiAmount: Decimal
  var principalComponent: Decimal
  var interestComponent: Decimal
  var remainingBalance: Decimal
  var status: String
  var paidAt: Date?
  var updatedAt: Date

  init(id: String, emiId: String, paymentNumber: Int, dueDate: Date,
       emiAmount: Decimal, principalComponent: Decimal,
       interestComponent: Decimal, remainingBalance: Decimal, status: String,
       paidAt: Date?, updatedAt: Date) {
    self.id = id
    self.emiId = emiId
    self.paymentNumber = paymentNumber
    self.dueDate = dueDate
    self.emiAmount = emiAmount
    self.principalComponent = principalComponent
    self.interestComponent = interestComponent
    self.remainingBalance = remainingBalance
    self.status = status
    self.paidAt = paidAt
    self.updatedAt = updatedAt
  }
}

@Model
final class AppNotification {
  @Attribute(.unique) var id: String
  var type: String
  var title: String
  var body: String
  var link: String?
  var readAt: Date?
  var createdAt: Date

  init(id: String, type: String, title: String, body: String, link: String?,
       readAt: Date?, createdAt: Date) {
    self.id = id
    self.type = type
    self.title = title
    self.body = body
    self.link = link
    self.readAt = readAt
    self.createdAt = createdAt
  }
}

func makeModelContainer(inMemory: Bool = false) throws -> ModelContainer {
  let schema = Schema([
    Profile.self, Investment.self, InvestmentDeposit.self,
    InvestmentWithdrawal.self, Emi.self, EmiPayment.self,
    AppNotification.self, PendingMutation.self, SyncIssue.self,
  ])
  let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: inMemory)
  return try ModelContainer(for: schema, configurations: [config])
}
