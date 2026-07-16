import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleCron } from '#/routes/api/cron/send-reminders'
import { createTestUser, prisma, resetDb } from './helpers/db'

// Neutralize web push (no VAPID-dependent behaviour under test here) and
// stub APNs so no network is touched.
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}))

const sendApns = vi.fn()
vi.mock('#/server/apns', () => ({
  buildApnsConfig: () => ({
    keyId: 'K',
    teamId: 'T',
    privateKey: 'pem',
    bundleId: 'com.phinio.app',
    host: 'https://api.sandbox.push.apple.com',
  }),
  sendApns: (...args: Array<unknown>) => sendApns(...args),
}))

const CRON_SECRET = 'test-cron-secret'

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET
  process.env.VAPID_PUBLIC_KEY = 'test-public'
  process.env.VAPID_PRIVATE_KEY = 'test-private'
  process.env.VAPID_SUBJECT = 'mailto:test@phinio.test'
})

function utcToday(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

async function seedDueEmiPayment(profileId: string) {
  const emi = await prisma.emi.create({
    data: {
      profileId,
      label: 'Cron loan',
      type: 'bank_loan',
      principal: '10000',
      interestRate: '10',
      tenureMonths: 1,
      emiAmount: '10083.33',
      startDate: utcToday(),
    },
  })
  await prisma.emiPayment.create({
    data: {
      emiId: emi.id,
      profileId,
      paymentNumber: 1,
      dueDate: utcToday(),
      emiAmount: '10083.33',
      principalComponent: '10000',
      interestComponent: '83.33',
      remainingBalance: '0',
      status: 'upcoming',
    },
  })
}

function cronRequest() {
  return new Request('http://localhost:3000/api/cron/send-reminders', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

beforeEach(async () => {
  await resetDb()
  sendApns.mockReset()
})

describe('cron APNs branch', () => {
  it('sends an APNs push per registered device token', async () => {
    sendApns.mockResolvedValue({ ok: true, gone: false })
    const user = await createTestUser()
    await prisma.deviceToken.create({
      data: { profileId: user.profileId, token: 'device-1' },
    })
    await seedDueEmiPayment(user.profileId)

    const res = await handleCron(cronRequest())
    const body = await res.json()
    expect(body.apnsPushed).toBe(1)
    expect(sendApns).toHaveBeenCalledTimes(1)
    const [, token, payload] = sendApns.mock.calls[0]
    expect(token).toBe('device-1')
    expect(payload.badge).toBe(1)
  })

  it('deletes tokens APNs reports gone', async () => {
    sendApns.mockResolvedValue({ ok: false, gone: true })
    const user = await createTestUser()
    await prisma.deviceToken.create({
      data: { profileId: user.profileId, token: 'stale-token' },
    })
    await seedDueEmiPayment(user.profileId)

    const res = await handleCron(cronRequest())
    const body = await res.json()
    expect(body.apnsExpired).toBe(1)
    expect(await prisma.deviceToken.count()).toBe(0)
  })

  it('profiles with no device tokens produce no APNs sends', async () => {
    const user = await createTestUser()
    await seedDueEmiPayment(user.profileId)
    const res = await handleCron(cronRequest())
    const body = await res.json()
    expect(body.apnsPushed).toBe(0)
    expect(sendApns).not.toHaveBeenCalled()
  })
})
