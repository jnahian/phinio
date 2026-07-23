import { createPrivateKey, sign } from 'node:crypto'
import { connect } from 'node:http2'

/**
 * Minimal APNs HTTP/2 sender for EMI/DPS payment reminders (design spec §4).
 * APNs requires HTTP/2 and Node's fetch is HTTP/1.1-only, so this speaks
 * node:http2 directly — ~40 lines instead of an SDK dependency.
 */

export interface ApnsConfig {
  keyId: string
  teamId: string
  privateKey: string
  bundleId: string
  host: string
}

export interface ApnsPayload {
  title: string
  body: string
  link: string
  badge?: number
}

export interface ApnsResult {
  ok: boolean
  gone: boolean
}

export function buildApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const bundleId = process.env.APNS_BUNDLE_ID
  if (!keyId || !teamId || !privateKey || !bundleId) return null
  const host =
    process.env.APNS_ENV === 'development'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com'
  return { keyId, teamId, privateKey, bundleId, host }
}

// APNs provider tokens must be refreshed at most hourly and reused for at
// least 20 minutes; cache for 50.
let cachedJwt: { token: string; expiresAt: number } | null = null

export function providerJwt(config: ApnsConfig, now = Date.now()): string {
  if (cachedJwt && cachedJwt.expiresAt > now) return cachedJwt.token
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  const unsigned = `${b64({ alg: 'ES256', kid: config.keyId })}.${b64({
    iss: config.teamId,
    iat: Math.floor(now / 1000),
  })}`
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: createPrivateKey(config.privateKey),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  const token = `${unsigned}.${signature}`
  cachedJwt = { token, expiresAt: now + 50 * 60 * 1000 }
  return token
}

export function sendApns(
  config: ApnsConfig,
  deviceToken: string,
  payload: ApnsPayload,
): Promise<ApnsResult> {
  return new Promise((resolve) => {
    const client = connect(config.host)
    client.on('error', () => resolve({ ok: false, gone: false }))
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerJwt(config)}`,
      'apns-topic': config.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })
    let status = 0
    let bodyText = ''
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0)
    })
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      bodyText += chunk
    })
    req.on('error', () => {
      client.close()
      resolve({ ok: false, gone: false })
    })
    req.on('end', () => {
      client.close()
      const gone =
        status === 410 ||
        (status === 400 && bodyText.includes('BadDeviceToken'))
      resolve({ ok: status === 200, gone })
    })
    req.end(
      JSON.stringify({
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: 'default',
          ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
        },
        link: payload.link,
      }),
    )
  })
}
