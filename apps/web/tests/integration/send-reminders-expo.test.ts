import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleCron } from '#/routes/api/cron/send-reminders'
import { createTestUser, prisma, resetDb } from './helpers/db'

// Web-push is mocked so the VAPID path never hits the network; the expo
// path is driven by spying on global fetch per test. Kept in its own file
// (separate from send-reminders.test.ts) so module/mock state is isolated.
const sendNotification = vi.fn()
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}))

const CRON_SECRET = 'test-cron-secret'

beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET
  process.env.VAPID_PUBLIC_KEY = 'test-public'
  process.env.VAPID_PRIVATE_KEY = 'test-private'
  process.env.VAPID_SUBJECT = 'mailto:test@phinio.test'
})

beforeEach(async () => {
  await resetDb()
  sendNotification.mockReset()
  sendNotification.mockResolvedValue(undefined)
})

function cronRequest() {
  const headers = new Headers()
  headers.set('authorization', `Bearer ${CRON_SECRET}`)
  return new Request('http://localhost/api/cron/send-reminders', {
    method: 'GET',
    headers,
  })
}

async function seedEmiPaymentDueToday(profileId: string): Promise<void> {
  const emi = await prisma.emi.create({
    data: {
      profileId,
      label: 'Test loan',
      type: 'bank_loan',
      principal: '1000',
      interestRate: '0',
      tenureMonths: 1,
      emiAmount: '1000',
      startDate: new Date(),
    },
  })
  const due = new Date()
  due.setUTCHours(0, 0, 0, 0)
  await prisma.emiPayment.create({
    data: {
      emiId: emi.id,
      profileId,
      paymentNumber: 1,
      dueDate: due,
      emiAmount: '1000',
      principalComponent: '1000',
      interestComponent: '0',
      remainingBalance: '0',
      status: 'upcoming',
    },
  })
}

function mockExpoFetch(
  tickets: { status: 'ok' | 'error'; details?: { error?: string } }[],
) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: tickets }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('cron — expo transport branch', () => {
  it('dispatches to expo tokens via exp.host with the unread badge', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueToday(user.profileId)
    await prisma.pushSubscription.create({
      data: {
        profileId: user.profileId,
        transport: 'expo',
        endpoint: 'ExponentPushToken[test-1]',
      },
    })

    const fetchSpy = mockExpoFetch([{ status: 'ok' }])
    try {
      const res = await handleCron(cronRequest())
      const body = (await res.json()) as { pushed: number; failed: number }
      expect(body.pushed).toBe(1)
      expect(body.failed).toBe(0)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://exp.host/--/api/v2/push/send')
      const messages = JSON.parse(String(init.body)) as {
        to: string
        badge?: number
        data: { notificationId: string }
      }[]
      expect(messages).toHaveLength(1)
      expect(messages[0].to).toBe('ExponentPushToken[test-1]')
      // One unread notification was just created for this profile.
      expect(messages[0].badge).toBe(1)
      // Web Push must not be attempted for an expo-only profile.
      expect(sendNotification).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('deletes DeviceNotRegistered tokens like expired web endpoints', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueToday(user.profileId)
    await prisma.pushSubscription.create({
      data: {
        profileId: user.profileId,
        transport: 'expo',
        endpoint: 'ExponentPushToken[stale]',
      },
    })

    const fetchSpy = mockExpoFetch([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ])
    try {
      const res = await handleCron(cronRequest())
      const body = (await res.json()) as { expired: number; pushed: number }
      expect(body.expired).toBe(1)
      expect(body.pushed).toBe(0)
      const remaining = await prisma.pushSubscription.count({
        where: { profileId: user.profileId },
      })
      expect(remaining).toBe(0)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('legacy web_push rows (defaulted transport) still go through VAPID', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueToday(user.profileId)
    // No transport supplied — column default backfills to web_push.
    await prisma.pushSubscription.create({
      data: {
        profileId: user.profileId,
        endpoint: 'https://push.example/sub-1',
        p256dh: 'key',
        auth: 'auth',
      },
    })

    const res = await handleCron(cronRequest())
    const body = (await res.json()) as { pushed: number }
    expect(body.pushed).toBe(1)
    expect(sendNotification).toHaveBeenCalledTimes(1)
  })
})
