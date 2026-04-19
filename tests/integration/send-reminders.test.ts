import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotification } from '#/server/notifications.impl'
import { handleCron } from '#/routes/api/cron/send-reminders'
import { createTestUser, prisma, resetDb } from './helpers/db'

// Mock the web-push library so tests never hit the network and we can drive
// failure modes (410 gone, transient failure) from the test body. vi.mock is
// hoisted above imports by vitest, so declaration order below the import is
// fine at runtime.
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

function cronRequest(init?: { auth?: string | null; method?: string }) {
  const headers = new Headers()
  if (init?.auth !== null) {
    headers.set('authorization', init?.auth ?? `Bearer ${CRON_SECRET}`)
  }
  return new Request('http://localhost/api/cron/send-reminders', {
    method: init?.method ?? 'GET',
    headers,
  })
}

async function seedEmiPaymentDueIn(
  profileId: string,
  offsetDays: number,
): Promise<string> {
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
  due.setHours(0, 0, 0, 0)
  due.setDate(due.getDate() + offsetDays)
  const payment = await prisma.emiPayment.create({
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
  return payment.id
}

describe('cron /api/cron/send-reminders — auth', () => {
  it('rejects missing Authorization header with 401', async () => {
    const res = await handleCron(cronRequest({ auth: null }))
    expect(res.status).toBe(401)
  })

  it('rejects wrong secret with 401', async () => {
    const res = await handleCron(cronRequest({ auth: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('rejects same-length wrong secret with 401 (constant-time compare)', async () => {
    const wrong = 'x'.repeat(CRON_SECRET.length)
    const res = await handleCron(cronRequest({ auth: `Bearer ${wrong}` }))
    expect(res.status).toBe(401)
  })

  it('accepts matching Bearer token', async () => {
    const res = await handleCron(cronRequest())
    expect(res.status).toBe(200)
  })
})

describe('cron — dedupe + idempotency', () => {
  it('creates exactly one notification per due payment; re-runs produce no new rows', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueIn(user.profileId, 1)

    const first = await handleCron(cronRequest())
    const firstBody = (await first.json()) as {
      created: number
      scanned: number
    }
    expect(firstBody.created).toBe(1)
    expect(firstBody.scanned).toBe(1)

    const second = await handleCron(cronRequest())
    const secondBody = (await second.json()) as { created: number }
    expect(secondBody.created).toBe(0)
  })

  it('classifies payments due today as due-soon, not overdue', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueIn(user.profileId, 0)

    const res = await handleCron(cronRequest())
    const body = (await res.json()) as { scanned: number; created: number }
    expect(body.scanned).toBe(1)
    expect(body.created).toBe(1)

    const row = await prisma.notification.findFirst({
      where: { profileId: user.profileId },
    })
    expect(row?.type).toBe('emi.payment.due')
  })

  it('classifies payments before today as overdue', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueIn(user.profileId, -1)

    const res = await handleCron(cronRequest())
    expect(res.status).toBe(200)

    const row = await prisma.notification.findFirst({
      where: { profileId: user.profileId },
    })
    expect(row?.type).toBe('emi.payment.overdue')
  })
})

describe('cron — push subscription lifecycle', () => {
  async function seedSubscription(profileId: string, endpoint: string) {
    await prisma.pushSubscription.create({
      data: { profileId, endpoint, p256dh: 'p256', auth: 'auth' },
    })
  }

  it('sends a push per subscription and increments `pushed`', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueIn(user.profileId, 1)
    await seedSubscription(user.profileId, 'https://push.test/endpoint-1')

    const res = await handleCron(cronRequest())
    const body = (await res.json()) as { pushed: number; created: number }

    expect(sendNotification).toHaveBeenCalledTimes(1)
    expect(body.created).toBe(1)
    expect(body.pushed).toBe(1)
  })

  it('deletes subscriptions that return 410 and reports them in `expired`', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueIn(user.profileId, 1)
    await seedSubscription(user.profileId, 'https://push.test/dead-endpoint')

    sendNotification.mockRejectedValueOnce(
      Object.assign(new Error('Gone'), { statusCode: 410 }),
    )

    const res = await handleCron(cronRequest())
    const body = (await res.json()) as {
      expired: number
      pushed: number
      failed: number
    }
    expect(body.expired).toBe(1)
    expect(body.pushed).toBe(0)
    expect(body.failed).toBe(0)

    const count = await prisma.pushSubscription.count({
      where: { profileId: user.profileId },
    })
    expect(count).toBe(0)
  })

  it('counts non-gone send errors as `failed` without deleting the subscription', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueIn(user.profileId, 1)
    await seedSubscription(user.profileId, 'https://push.test/flaky-endpoint')

    sendNotification.mockRejectedValueOnce(
      Object.assign(new Error('Transient'), { statusCode: 500 }),
    )

    const res = await handleCron(cronRequest())
    const body = (await res.json()) as {
      failed: number
      expired: number
      pushed: number
    }
    expect(body.failed).toBe(1)
    expect(body.expired).toBe(0)
    expect(body.pushed).toBe(0)

    const count = await prisma.pushSubscription.count({
      where: { profileId: user.profileId },
    })
    expect(count).toBe(1)
  })

  it('fetches subscriptions once per profile even with many notifications', async () => {
    const user = await createTestUser()
    await seedEmiPaymentDueIn(user.profileId, 1)
    await seedEmiPaymentDueIn(user.profileId, 2)
    await seedEmiPaymentDueIn(user.profileId, 3)
    await seedSubscription(user.profileId, 'https://push.test/one')

    const original = prisma.pushSubscription.findMany.bind(
      prisma.pushSubscription,
    )
    const spy = vi
      .spyOn(prisma.pushSubscription, 'findMany')
      .mockImplementation((args) => original(args))
    try {
      const res = await handleCron(cronRequest())
      const body = (await res.json()) as { created: number; pushed: number }
      expect(body.created).toBe(3)
      expect(body.pushed).toBe(3)
      // Batched: one findMany for all three notifications.
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('createNotification — race path', () => {
  it('returns created=false when (profileId, dedupeKey) already exists', async () => {
    const user = await createTestUser()
    const first = await createNotification({
      profileId: user.profileId,
      type: 'test',
      title: 'x',
      body: 'y',
      dedupeKey: 'dup:1',
    })
    expect(first.created).toBe(true)

    const second = await createNotification({
      profileId: user.profileId,
      type: 'test',
      title: 'x',
      body: 'y',
      dedupeKey: 'dup:1',
    })
    expect(second.created).toBe(false)
    expect(second.id).toBe(first.id)
  })

  it('propagates non-P2002 errors instead of swallowing them', async () => {
    // Simulate a non-unique-constraint DB error by spying on create.
    const spy = vi
      .spyOn(prisma.notification, 'create')
      .mockRejectedValueOnce(
        Object.assign(new Error('DB down'), { code: 'P1001' }),
      )

    const user = await createTestUser()
    await expect(
      createNotification({
        profileId: user.profileId,
        type: 'test',
        title: 'x',
        body: 'y',
        dedupeKey: 'db-error:1',
      }),
    ).rejects.toThrow(/DB down/)

    spy.mockRestore()
  })
})
