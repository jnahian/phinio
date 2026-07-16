import webpush from 'web-push'

export interface PushPayload {
  title: string
  body: string
  link: string
  dedupeKey: string
  notificationId: string
}

export interface WebPushConfig {
  subject: string
  publicKey: string
  privateKey: string
}

/**
 * Resolve VAPID config from env. Returns null when required vars are missing
 * so callers can surface a clear error instead of crashing mid-scan.
 */
export function buildWebPushConfig(): WebPushConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return null
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return { subject, publicKey, privateKey }
}

export interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

export interface SendResult {
  ok: boolean
  gone: boolean
}

export async function sendWebPush(
  _config: WebPushConfig,
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    )
    return { ok: true, gone: false }
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      return { ok: false, gone: true }
    }
    console.error('[web-push] send failed', err)
    return { ok: false, gone: false }
  }
}
