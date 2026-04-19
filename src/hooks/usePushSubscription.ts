import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { deletePushSubscriptionFn, savePushSubscriptionFn } from '#/server/push'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined

type Permission = NotificationPermission | 'unsupported'

interface UsePushSubscription {
  isSupported: boolean
  permission: Permission
  isSubscribed: boolean
  isBusy: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

/**
 * Web Push subscription lifecycle. Reflects browser permission state,
 * the presence of a live PushSubscription, and exposes subscribe/unsubscribe
 * wrappers that sync the endpoint with our backend.
 *
 * VITE_VAPID_PUBLIC_KEY must be defined at build time. Missing key disables
 * subscribe() with a toast rather than silently failing.
 */
export function usePushSubscription(): UsePushSubscription {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const [permission, setPermission] = useState<Permission>(() =>
    typeof window === 'undefined' || !('Notification' in window)
      ? 'unsupported'
      : Notification.permission,
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  // Mirror isBusy in a ref so the focus/visibilitychange listener can skip
  // syncSubscriptionState while a subscribe/unsubscribe is in flight.
  // A ref is required — the listener's closure would capture a stale
  // `isBusy` value otherwise — and without this guard the listener's
  // getSubscription() races subscribe()'s own updates and can overwrite
  // setIsSubscribed(true) with a stale false.
  const busyRef = useRef(false)

  const syncSubscriptionState = useCallback(async () => {
    if (!isSupported) return
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      setIsSubscribed(sub !== null)
    } catch {
      setIsSubscribed(false)
    }
  }, [isSupported])

  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
    void syncSubscriptionState()

    // Pick up permission flips made in another tab / browser settings.
    // `Notification.permission` is not observable directly; re-read on
    // focus + visibilitychange, which covers the return-to-tab case.
    const refresh = () => {
      setPermission(Notification.permission)
      if (!busyRef.current) void syncSubscriptionState()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [isSupported, syncSubscriptionState])

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error('Browser notifications are not supported on this device')
      return
    }
    if (!VAPID_PUBLIC_KEY) {
      toast.error('Push notifications are not configured')
      return
    }
    if (busyRef.current) return
    busyRef.current = true
    setIsBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        if (perm === 'denied') {
          toast.error(
            'Notifications are blocked. Enable them in your browser settings.',
          )
        }
        return
      }
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const sub =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))
      const json = sub.toJSON() as {
        endpoint?: string
        keys?: { p256dh?: string; auth?: string }
      }
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Invalid push subscription')
      }
      await savePushSubscriptionFn({
        data: {
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent,
        },
      })
      setIsSubscribed(true)
      toast.success('Browser notifications enabled')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not enable notifications',
      )
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || busyRef.current) return
    busyRef.current = true
    setIsBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      const endpoint = sub?.endpoint
      if (sub) await sub.unsubscribe()
      if (endpoint) {
        await deletePushSubscriptionFn({ data: { endpoint } })
      }
      setIsSubscribed(false)
      toast.success('Browser notifications disabled')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not disable notifications',
      )
    } finally {
      busyRef.current = false
      setIsBusy(false)
    }
  }, [isSupported])

  return {
    isSupported,
    permission,
    isSubscribed,
    isBusy,
    subscribe,
    unsubscribe,
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
