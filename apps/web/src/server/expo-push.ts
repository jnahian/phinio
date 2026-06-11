import type { PushPayload } from './web-push'

/**
 * Expo push dispatch for native (Phase 6). Tokens are stored in
 * `PushSubscription.endpoint` with `transport='expo'`. Expo's push API
 * accepts up to 100 messages per request; we chunk accordingly.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const CHUNK_SIZE = 100

export interface ExpoSendResult {
  endpoint: string
  ok: boolean
  /** Token no longer valid (DeviceNotRegistered) — delete the row. */
  gone: boolean
}

interface ExpoTicket {
  status: 'ok' | 'error'
  message?: string
  details?: { error?: string }
}

export async function sendExpoPushBatch(
  tokens: { endpoint: string; badge?: number }[],
  payload: PushPayload,
): Promise<ExpoSendResult[]> {
  const results: ExpoSendResult[] = []

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE)
    const messages = chunk.map((tkn) => ({
      to: tkn.endpoint,
      title: payload.title,
      body: payload.body,
      sound: 'default' as const,
      ...(tkn.badge !== undefined ? { badge: tkn.badge } : {}),
      data: {
        link: payload.link,
        dedupeKey: payload.dedupeKey,
        notificationId: payload.notificationId,
      },
    }))

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(messages),
      })
      if (!res.ok) {
        for (const tkn of chunk) {
          results.push({ endpoint: tkn.endpoint, ok: false, gone: false })
        }
        continue
      }
      const json = (await res.json()) as { data?: ExpoTicket[] }
      const tickets = json.data ?? []
      chunk.forEach((tkn, idx) => {
        const ticket = tickets[idx]
        if (ticket?.status === 'ok') {
          results.push({ endpoint: tkn.endpoint, ok: true, gone: false })
        } else {
          const gone = ticket?.details?.error === 'DeviceNotRegistered'
          results.push({ endpoint: tkn.endpoint, ok: false, gone })
        }
      })
    } catch (err) {
      console.error('[expo-push] batch send failed', err)
      for (const tkn of chunk) {
        results.push({ endpoint: tkn.endpoint, ok: false, gone: false })
      }
    }
  }

  return results
}
