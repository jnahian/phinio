import SwiftUI
import UIKit
import UserNotifications

enum PushManager {
  private static let tokenKey = "apnsDeviceToken"

  static var deviceTokenForLogout: String? {
    UserDefaults.standard.string(forKey: tokenKey)
  }

  /// Priming flow: request permission, then register with APNs. The token
  /// arrives async in AppDelegate.didRegisterForRemoteNotifications.
  @MainActor
  static func requestAndRegister() async {
    let granted = (try? await UNUserNotificationCenter.current()
      .requestAuthorization(options: [.alert, .badge, .sound])) ?? false
    guard granted else { return }
    UIApplication.shared.registerForRemoteNotifications()
  }

  static func handleDeviceToken(_ deviceToken: Data) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(hex, forKey: tokenKey)
    // Upsert-on-token server-side, so a plain retry-less POST is fine —
    // the next launch re-registers anyway.
    Task {
      try? await APIClient().post(
        path: "/api/v1/device-tokens",
        body: try? JSONSerialization.data(withJSONObject:
          ["token": hex, "platform": "ios"]),
        method: "POST", idempotencyKey: UUID())
    }
  }
}

final class AppDelegate: NSObject, UIApplicationDelegate,
                         UNUserNotificationCenterDelegate {
  static weak var router: DeepLinkRouter?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions:
      [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    // Re-register on every launch if permission was already granted, so a
    // rotated APNs token reaches the server without user action.
    Task { @MainActor in
      let status = await UNUserNotificationCenter.current()
        .notificationSettings().authorizationStatus
      if status == .authorized {
        UIApplication.shared.registerForRemoteNotifications()
      }
    }
    return true
  }

  func application(_ application: UIApplication,
                   didRegisterForRemoteNotificationsWithDeviceToken
                     deviceToken: Data) {
    PushManager.handleDeviceToken(deviceToken)
  }

  // Reminder tapped → deep-link to the EMI / DPS detail.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    let userInfo = response.notification.request.content.userInfo
    if let link = userInfo["link"] as? String,
       let parsed = DeepLink.parse(link) {
      await MainActor.run { Self.router?.pending = parsed }
    }
  }

  // Show reminders as banners while the app is foregrounded too.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .badge, .sound]
  }
}
