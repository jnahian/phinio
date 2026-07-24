import Foundation

enum APIError: Error, Equatable {
  case unauthorized
  case rejected(code: String, message: String)
  case retryable
  case decoding
}

struct ErrorEnvelope: Decodable {
  struct Inner: Decodable {
    let code: String
    let message: String
  }
  let error: Inner
}

/// Better Auth (`/api/auth/*`) returns errors flat — `{"code","message"}` —
/// unlike the app's own `/api/v1` endpoints, which nest under `error`.
struct AuthErrorBody: Decodable {
  let code: String
  let message: String
}
