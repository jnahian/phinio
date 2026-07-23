import Foundation
import Security

/// Bearer-token storage. One generic-password item; the token is the only
/// secret the app holds.
enum Keychain {
  private static let service = "com.phinio.app.auth"
  private static let account = "bearer-token"

  private static var query: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }

  static func saveToken(_ token: String) {
    deleteToken()
    var attrs = query
    attrs[kSecValueData as String] = Data(token.utf8)
    attrs[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    SecItemAdd(attrs as CFDictionary, nil)
  }

  static func loadToken() -> String? {
    var q = query
    q[kSecReturnData as String] = true
    q[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: AnyObject?
    guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data
    else { return nil }
    return String(data: data, encoding: .utf8)
  }

  static func deleteToken() {
    SecItemDelete(query as CFDictionary)
  }
}
