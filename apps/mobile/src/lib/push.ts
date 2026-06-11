import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { trpcClient } from './trpc'

/**
 * Expo push registration (Phase 6B). The token is stored server-side in
 * PushSubscription.endpoint with transport='expo'; the reminders cron
 * dispatches through exp.host. Returns the token on success, null when
 * permission is denied or the runtime can't issue tokens (simulator,
 * Expo Go without a projectId).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null

  // The inherited PermissionResponse members (granted/status) don't
  // surface through this pnpm hoist's type graph — narrow explicitly.
  type Granted = { granted: boolean }
  const existing = (await Notifications.getPermissionsAsync()) as Granted
  let granted = existing.granted
  if (!granted) {
    const requested =
      (await Notifications.requestPermissionsAsync()) as Granted
    granted = requested.granted
  }
  if (!granted) return null

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  const token = (
    await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
  ).data

  await trpcClient.push.save.mutate({
    transport: 'expo',
    endpoint: token,
    userAgent: Device.modelName ?? null,
  })
  return token
}

/** Remove this device's token server-side (reminders stop for this device). */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId
    const token = (
      await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      )
    ).data
    await trpcClient.push.delete.mutate({ endpoint: token })
  } catch {
    // Token unavailable (permission revoked, simulator) — nothing to delete.
  }
}

/**
 * iOS badge = unread Notification rows (spec §6.3). The cron sets it on
 * push receipt; the app re-syncs it on foreground via the unread-count
 * query (see app/(app)/_layout.tsx).
 */
export async function syncBadgeCount(unread: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(unread)
  } catch {
    // Badges unsupported on this platform/runtime — ignore.
  }
}

/** Foreground presentation: show banner + play sound, mirror badge. */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
  })
}
