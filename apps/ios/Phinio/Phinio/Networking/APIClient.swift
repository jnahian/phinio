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

  /// Bearer-token client: auth rides in the `Authorization` header, never a
  /// cookie. On the shared session URLSession would store Better Auth's
  /// Set-Cookie and re-send it on the next request — and a native request has
  /// no Origin header, so Better Auth's CSRF check rejects it with "Missing or
  /// null Origin". Drop cookie handling entirely.
  static let cookielessSession: URLSession = {
    let config = URLSessionConfiguration.default
    config.httpShouldSetCookies = false
    config.httpCookieStorage = nil
    config.httpCookieAcceptPolicy = .never
    return URLSession(configuration: config)
  }()

  init(session: URLSession = APIClient.cookielessSession,
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
      let body = try? JSONDecoder().decode(AuthErrorBody.self, from: data)
      throw APIError.rejected(
        code: body?.code ?? "sign_in_failed",
        message: body?.message ?? "Sign-in failed")
    }
    guard let token = http.value(forHTTPHeaderField: "set-auth-token") else {
      throw APIError.decoding
    }
    return token
  }

  /// Create an account. Better Auth requires email verification before
  /// sign-in succeeds, so no token comes back here.
  func signUp(name: String, email: String, password: String,
              preferredCurrency: String) async throws {
    var req = request(path: "/api/auth/sign-up/email", method: "POST")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(
      ["name": name, "email": email, "password": password,
       "preferredCurrency": preferredCurrency])
    let (data, response): (Data, URLResponse)
    do {
      (data, response) = try await session.data(for: req)
    } catch {
      throw APIError.retryable
    }
    guard let http = response as? HTTPURLResponse,
          (200...299).contains(http.statusCode) else {
      let body = try? JSONDecoder().decode(AuthErrorBody.self, from: data)
      throw APIError.rejected(
        code: body?.code ?? "sign_up_failed",
        message: body?.message ?? "Sign-up failed")
    }
  }

  /// Kick off Better Auth's password-reset email. Succeeds even for unknown
  /// addresses (Better Auth avoids account enumeration); the emailed link opens
  /// the web reset page, so the app only fires the request.
  func requestPasswordReset(email: String) async throws {
    var req = request(path: "/api/auth/request-password-reset", method: "POST")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(["email": email, "redirectTo": "/login"])
    let (data, response): (Data, URLResponse)
    do {
      (data, response) = try await session.data(for: req)
    } catch {
      throw APIError.retryable
    }
    guard let http = response as? HTTPURLResponse,
          (200...299).contains(http.statusCode) else {
      let body = try? JSONDecoder().decode(AuthErrorBody.self, from: data)
      throw APIError.rejected(
        code: body?.code ?? "reset_failed",
        message: body?.message ?? "Reset request failed")
    }
  }

  /// Profile photo lives on Better Auth's `user.image` as a data URL — the same
  /// column and the same encoding the web profile screen writes (300px longest
  /// edge, JPEG q0.85). No blob storage in the stack, so the app reads and
  /// writes it through Better Auth directly rather than a Phinio endpoint.
  func fetchAvatar() async throws -> String? {
    let data = try await run(request(path: "/api/auth/get-session", method: "GET"))
    // An expired session returns 200 with a literal `null` body, not a 401.
    return (try? JSONDecoder().decode(SessionUserEnvelope.self, from: data))?.user.image
  }

  func updateAvatar(dataURL: String) async throws {
    var req = request(path: "/api/auth/update-user", method: "POST")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONEncoder().encode(["image": dataURL])
    _ = try await run(req)
  }

  /// Built with URLComponents rather than `request(path:)` — `appending(path:)`
  /// would percent-encode the `?` and break the query string.
  func fetchActivity(cursor: String?) async throws -> ActivityPageDTO {
    var comps = URLComponents(
      url: baseURL.appending(path: "/api/v1/activity"),
      resolvingAgainstBaseURL: false)!
    comps.queryItems = [URLQueryItem(name: "limit", value: "30")]
    if let cursor {
      comps.queryItems!.append(URLQueryItem(name: "cursor", value: cursor))
    }
    var req = URLRequest(url: comps.url!)
    req.httpMethod = "GET"
    if let token = tokenProvider() {
      req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    let data = try await run(req)
    do {
      return try JSONDecoder().decode(ActivityPageDTO.self, from: data)
    } catch {
      throw APIError.decoding
    }
  }
}
