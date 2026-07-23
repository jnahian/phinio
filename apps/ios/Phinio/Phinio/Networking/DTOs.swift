import Foundation

/// Wire shapes for GET /api/v1/sync/snapshot. Field names match the JSON
/// exactly; money stays String here and becomes Decimal at model-apply time.
nonisolated struct ProfileDTO: Decodable {
  let id: String
  let fullName: String
  let preferredCurrency: String
  let preferredLanguage: String
  let updatedAt: String
}

nonisolated struct InvestmentDTO: Decodable {
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

nonisolated struct InvestmentDepositDTO: Decodable {
  let id: String
  let investmentId: String
  let amount: String
  let accruedValue: String?
  let dueDate: String?
  let depositDate: String?
  let installmentNumber: Int?
  let status: String
  let notes: String?
  let updatedAt: String
}

nonisolated struct InvestmentWithdrawalDTO: Decodable {
  let id: String
  let investmentId: String
  let amount: String
  let withdrawalDate: String
  let notes: String?
}

nonisolated struct EmiDTO: Decodable {
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

nonisolated struct EmiPaymentDTO: Decodable {
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

nonisolated struct NotificationDTO: Decodable {
  let id: String
  let type: String
  let title: String
  let body: String
  let link: String?
  let readAt: String?
  let createdAt: String
}

nonisolated struct SnapshotDTO: Decodable {
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
nonisolated struct ActivityChangeDTO: Decodable {
  let field: String
  let from: String?
  let to: String?
  let currency: String?
}

nonisolated struct ActivityItemDTO: Decodable, Identifiable {
  let id: String
  let action: String
  let entityType: String
  let entityId: String?
  let entityLabel: String
  let summary: String
  let changes: [ActivityChangeDTO]?
  let createdAt: String
}

nonisolated struct ActivityPageDTO: Decodable {
  let items: [ActivityItemDTO]
  let nextCursor: String?
}
