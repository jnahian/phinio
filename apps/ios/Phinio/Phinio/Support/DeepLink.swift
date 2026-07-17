import Combine
import Foundation

/// Parses the `link` field the reminder cron puts in notifications
/// (send-reminders.ts): "/app/emis/<id>" and "/app/investments/dps/<id>".
nonisolated enum DeepLink: Equatable {
  case emi(String)
  case dps(String)

  static func parse(_ link: String) -> DeepLink? {
    let parts = link.split(separator: "/").map(String.init)
    if parts.count == 3, parts[0] == "app", parts[1] == "emis" {
      return .emi(parts[2])
    }
    if parts.count == 4, parts[0] == "app", parts[1] == "investments",
      parts[2] == "dps"
    {
      return .dps(parts[3])
    }
    return nil
  }
}

@MainActor
final class DeepLinkRouter: ObservableObject {
  @Published var pending: DeepLink?
}
