import Foundation

/// Wire shapes for GET /api/v1/sync/snapshot. Field names match the JSON
/// exactly; money stays String here and becomes Decimal at model-apply time.
struct ProfileDTO: Decodable {
  let id: String
  let fullName: String
  let preferredCurrency: String
  let preferredLanguage: String
  let updatedAt: String
}

struct InvestmentDTO: Decodable {
  let id: String
  let name: String
  let type: String
  let mode: String
  let status: String
  let investedAmount: String
  let currentValue: String
  let exitValue: String?
  let dateOfInvestment: String?
  let startDate: String?
  let monthlyDeposit: String?
  let tenureMonths: Int?
  let interestRate: String?
  let interestType: String?
  let estimatedClosureDate: String?
  let completedAt: String?
  let notes: String?
  let updatedAt: String
}

struct InvestmentDepositDTO: Decodable {
  let id: String
  let investmentId: String
  let amount: String
  let dueDate: String?
  let depositDate: String?
  let installmentNumber: Int?
  let status: String
  let notes: String?
  let updatedAt: String
}

struct InvestmentWithdrawalDTO: Decodable {
  let id: String
  let investmentId: String
  let amount: String
  let withdrawalDate: String
  let notes: String?
}

struct EmiDTO: Decodable {
  let id: String
  let label: String
  let type: String
  let principal: String
  let interestRate: String
  let tenureMonths: Int
  let emiAmount: String
  let startDate: String
  let status: String
  let notes: String?
  let updatedAt: String
}

struct EmiPaymentDTO: Decodable {
  let id: String
  let emiId: String
  let paymentNumber: Int
  let dueDate: String
  let emiAmount: String
  let principalComponent: String
  let interestComponent: String
  let remainingBalance: String
  let status: String
  let paidAt: String?
  let updatedAt: String
}

struct NotificationDTO: Decodable {
  let id: String
  let type: String
  let title: String
  let body: String
  let link: String?
  let readAt: String?
  let createdAt: String
}

struct SnapshotDTO: Decodable {
  let serverTime: String
  let profile: ProfileDTO
  let investments: [InvestmentDTO]
  let investmentDeposits: [InvestmentDepositDTO]
  let investmentWithdrawals: [InvestmentWithdrawalDTO]
  let emis: [EmiDTO]
  let emiPayments: [EmiPaymentDTO]
  let notifications: [NotificationDTO]
}

/// Wire shapes for GET /api/v1/activity. Server-derived, not in the snapshot.
struct ActivityChangeDTO: Decodable {
  let field: String
  let from: String?
  let to: String?
  let currency: String?
}

struct ActivityItemDTO: Decodable, Identifiable {
  let id: String
  let action: String
  let entityType: String
  let entityId: String?
  let entityLabel: String
  let summary: String
  let changes: [ActivityChangeDTO]?
  let createdAt: String
}

struct ActivityPageDTO: Decodable {
  let items: [ActivityItemDTO]
  let nextCursor: String?
}
