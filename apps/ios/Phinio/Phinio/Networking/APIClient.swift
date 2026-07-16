import Foundation

protocol SyncTransport: Sendable {
  func post(path: String, body: Data?, method: String, idempotencyKey: UUID) async throws
  func fetchSnapshot() async throws -> SnapshotDTO
}

/// The only place that talks HTTP. Bearer token comes from `tokenProvider`
/// (Keychain in the app, a closure in tests).
final class APIClient: SyncTransport {
  private let session: URLSession
  private let baseURL: URL
  private let tokenProvider: @Sendable () -> String?

  init(session: URLSession = .shared,
       baseURL: URL = AppConfig.baseURL,
       tokenProvider: @escaping @Sendable () -> String? = { Keychain.loadToken() }) {
    self.session = session
    self.baseURL = baseURL
    self.tokenProvider = tokenProvider
  }

  private func request(path: String, method: String) -> URLRequest {
    var req = URLRequest(url: baseURL.appending(path: path))
    req.httpMethod = method
    if let token = tokenProvider() {
      req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    return req
  }

  private func run(_ req: URLRequest) async throws -> Data {
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await session.data(for: req)
    } catch {
      throw APIError.retryable
    }
    guard let http = response as? HTTPURLResponse else { throw APIError.retryable }
    switch http.statusCode {
    case 200...299:
      return data
    case 401:
      throw APIError.unauthorized
    case 400, 404, 409, 422:
      let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data)
      throw APIError.rejected(
        code: envelope?.error.code ?? "rejected",
        message: envelope?.error.message ?? "Request rejected")
    default:
      throw APIError.retryable
    }
  }

  func post(path: String, body: Data?, method: String, idempotencyKey: UUID) async throws {
    var req = request(path: path, method: method)
    req.setValue(idempotencyKey.uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
    if let body {
      req.setValue("application/json", forHTTPHeaderField: "Content-Type")
      req.httpBody = body
    }
    _ = try await run(req)
  }

  func fetchSnapshot() async throws -> SnapshotDTO {
    let data = try await run(request(path: "/api/v1/sync/snapshot", method: "GET"))
    do {
      return try JSONDecoder().decode(SnapshotDTO.self, from: data)
    } catch {
      throw APIError.decoding
    }
  }

  /// Sign in against Better Auth; the bearer token arrives in the
  /// `set-auth-token` response header (bearer plugin).
  func signIn(email: String, password: String) async throws -> String {
    var req = request(path: "/api/auth/sign-in/email", method: "POST")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(["email": email, "password": password])
    let (data, response): (Data, URLResponse)
    do {
      (data, response) = try await session.data(for: req)
    } catch {
      throw APIError.retryable
    }
    guard let http = response as? HTTPURLResponse else { throw APIError.retryable }
    guard http.statusCode == 200 else {
      let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data)
      throw APIError.rejected(
        code: envelope?.error.code ?? "sign_in_failed",
        message: envelope?.error.message ?? "Sign-in failed")
    }
    guard let token = http.value(forHTTPHeaderField: "set-auth-token") else {
      throw APIError.decoding
    }
    return token
  }
}
