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
