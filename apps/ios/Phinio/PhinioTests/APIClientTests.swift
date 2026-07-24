import Foundation
import Testing
@testable import Phinio

/// URLProtocol stub: queue (status, body) responses and capture requests.
final class StubURLProtocol: URLProtocol {
  nonisolated(unsafe) static var responses: [(Int, Data)] = []
  nonisolated(unsafe) static var requests: [URLRequest] = []

  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    Self.requests.append(request)
    let (status, data) = Self.responses.isEmpty ? (200, Data("{}".utf8)) : Self.responses.removeFirst()
    let response = HTTPURLResponse(
      url: request.url!, statusCode: status, httpVersion: nil,
      headerFields: ["content-type": "application/json"])!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: data)
    client?.urlProtocolDidFinishLoading(self)
  }

  override func stopLoading() {}
}

/// URLSession swaps `httpBody` for `httpBodyStream` before the protocol sees
/// the request, so the body has to be drained from the stream.
extension URLRequest {
  var bodyData: Data? {
    if let httpBody { return httpBody }
    guard let stream = httpBodyStream else { return nil }
    stream.open()
    defer { stream.close() }
    var data = Data()
    let size = 4096
    let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: size)
    defer { buffer.deallocate() }
    while stream.hasBytesAvailable {
      let read = stream.read(buffer, maxLength: size)
      if read <= 0 { break }
      data.append(buffer, count: read)
    }
    return data
  }
}

private func makeClient(token: String? = "tok") -> APIClient {
  let config = URLSessionConfiguration.ephemeral
  config.protocolClasses = [StubURLProtocol.self]
  return APIClient(
    session: URLSession(configuration: config),
    baseURL: URL(string: "http://test.local")!,
    tokenProvider: { token })
}

// Serialized: the URLProtocol stub is process-global static state, so
// parallel tests would consume each other's queued responses.
@Suite(.serialized)
struct APIClientTests {
  init() {
    StubURLProtocol.responses = []
    StubURLProtocol.requests = []
  }

  @Test func postSendsBearerAndIdempotencyKey() async throws {
    StubURLProtocol.responses = [(200, Data("{}".utf8))]
    let client = makeClient()
    let key = UUID()
    try await client.post(
      path: "/api/v1/emis", body: Data("{}".utf8), method: "POST",
      idempotencyKey: key)
    let req = StubURLProtocol.requests.last!
    #expect(req.value(forHTTPHeaderField: "Authorization") == "Bearer tok")
    #expect(req.value(forHTTPHeaderField: "Idempotency-Key") == key.uuidString.lowercased())
    #expect(req.value(forHTTPHeaderField: "Content-Type") == "application/json")
  }

  @Test func maps401ToUnauthorized() async {
    StubURLProtocol.responses = [(401, Data(#"{"error":{"code":"unauthorized","message":"Unauthorized"}}"#.utf8))]
    let client = makeClient()
    await #expect(throws: APIError.unauthorized) {
      try await client.post(path: "/x", body: nil, method: "POST", idempotencyKey: UUID())
    }
  }

  @Test func maps422ToRejectedWithEnvelope() async {
    StubURLProtocol.responses = [(422, Data(#"{"error":{"code":"rejected","message":"Withdrawal amount exceeds current value"}}"#.utf8))]
    let client = makeClient()
    await #expect(throws: APIError.rejected(
      code: "rejected", message: "Withdrawal amount exceeds current value")) {
      try await client.post(path: "/x", body: nil, method: "POST", idempotencyKey: UUID())
    }
  }

  @Test func requestPasswordResetPostsEmailToBetterAuth() async throws {
    StubURLProtocol.responses = [(200, Data("{}".utf8))]
    let client = makeClient()
    try await client.requestPasswordReset(email: "a@b.com")
    let req = StubURLProtocol.requests.last!
    #expect(req.url?.path == "/api/auth/request-password-reset")
    #expect(req.httpMethod == "POST")
    let body = try #require(req.bodyData)
    let json = try JSONSerialization.jsonObject(with: body) as? [String: String]
    #expect(json?["email"] == "a@b.com")
    #expect(json?["redirectTo"] == "/login")
  }

  @Test func maps500ToRetryable() async {
    StubURLProtocol.responses = [(500, Data("{}".utf8))]
    let client = makeClient()
    await #expect(throws: APIError.retryable) {
      try await client.post(path: "/x", body: nil, method: "POST", idempotencyKey: UUID())
    }
  }
}
