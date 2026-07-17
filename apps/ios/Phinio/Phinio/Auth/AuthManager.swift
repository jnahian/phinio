import Combine
import Foundation
import SwiftData

@MainActor
final class AuthManager: ObservableObject {
  @Published private(set) var isAuthenticated: Bool
  private let client: APIClient

  init(client: APIClient) {
    self.client = client
    self.isAuthenticated = Keychain.loadToken() != nil
  }

  func signIn(email: String, password: String) async throws {
    let token = try await client.signIn(email: email, password: password)
    Keychain.saveToken(token)
    isAuthenticated = true
  }

  func signUp(name: String, email: String, password: String) async throws {
    try await client.signUp(name: name, email: email, password: password)
  }

  /// Explicit logout: drop the token and wipe local data (spec §2).
  func signOut(container: ModelContainer) {
    Keychain.deleteToken()
    let context = container.mainContext
    try? context.delete(model: Profile.self)
    try? context.delete(model: Investment.self)
    try? context.delete(model: InvestmentDeposit.self)
    try? context.delete(model: InvestmentWithdrawal.self)
    try? context.delete(model: Emi.self)
    try? context.delete(model: EmiPayment.self)
    try? context.delete(model: AppNotification.self)
    try? context.delete(model: PendingMutation.self)
    try? context.delete(model: SyncIssue.self)
    try? context.save()
    isAuthenticated = false
  }
}
