import Foundation

enum AppConfig {
  /// Debug override for physical-device testing against the Mac's dev
  /// server, where localhost points at the phone itself. Set it in the
  /// scheme: Edit Scheme → Run → Arguments → Environment Variables →
  /// PHINIO_BASE_URL = http://<mac-lan-ip>:3000 (applies only to
  /// Xcode-launched runs, which device debugging always is).
  static var baseURL: URL {
    #if DEBUG
      if let override = ProcessInfo.processInfo.environment["PHINIO_BASE_URL"],
         let url = URL(string: override) {
        return url
      }
      return URL(string: "http://localhost:3000")!
    #else
      return URL(string: "https://phinio.jnahian.me")!
    #endif
  }
}
