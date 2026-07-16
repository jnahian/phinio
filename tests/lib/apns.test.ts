import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildApnsConfig, providerJwt } from '#/server/apns'
import type { ApnsConfig } from '#/server/apns'

function testConfig(): { config: ApnsConfig; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  return {
    config: {
      keyId: 'TESTKEY123',
      teamId: 'TESTTEAM12',
      privateKey,
      bundleId: 'com.phinio.app',
      host: 'https://api.sandbox.push.apple.com',
    },
    publicKey,
  }
}

describe('providerJwt', () => {
  it('produces a valid ES256 JWT with kid + iss + iat', () => {
    const { config, publicKey } = testConfig()
    const jwt = providerJwt(config, Date.now())
    const [h, p, s] = jwt.split('.')
    expect(s).toBeTruthy()
    const header = JSON.parse(Buffer.from(h, 'base64url').toString())
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    expect(header).toEqual({ alg: 'ES256', kid: 'TESTKEY123' })
    expect(payload.iss).toBe('TESTTEAM12')
    expect(payload.iat).toBeTypeOf('number')
    const valid = verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(s, 'base64url'),
    )
    expect(valid).toBe(true)
  })

  it('reuses the cached token within the refresh window', () => {
    const { config } = testConfig()
    const now = Date.now()
    const a = providerJwt(config, now)
    const b = providerJwt(config, now + 60_000)
    expect(b).toBe(a)
  })
})

describe('buildApnsConfig', () => {
  it('returns null when env vars are missing', () => {
    expect(buildApnsConfig()).toBeNull()
  })
})
