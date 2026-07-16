import { beforeEach, describe, expect, it } from 'vitest'
import { createNotification } from '#/server/notifications.impl'
import { handleListNotifications } from '#/routes/api/v1/notifications.index'
import { handleUnreadCount } from '#/routes/api/v1/notifications.unread-count'
import { handleMarkRead } from '#/routes/api/v1/notifications.$id.read'
import { handleMarkAllRead } from '#/routes/api/v1/notifications.read-all'
import { handleClearRead } from '#/routes/api/v1/notifications.clear-read'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

async function seed(profileId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await createNotification({
      profileId,
      type: 'emi.payment.due',
      title: `Reminder ${i}`,
      body: 'Payment due',
      link: '/app/emis/x',
      dedupeKey: `test-${i}`,
    })
  }
}

describe('notification REST routes', () => {
  it('lists notifications and reports unread count', async () => {
    const user = await createAuthedUser()
    await seed(user.profileId, 3)
    const list = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: user.token }),
      )
    ).json()
    expect(list).toHaveLength(3)
    const count = await (
      await handleUnreadCount(
        apiRequest('/api/v1/notifications/unread-count', {
          token: user.token,
        }),
      )
    ).json()
    expect(count.count).toBe(3)
  })

  it('marks one read, then all read, then clears read', async () => {
    const user = await createAuthedUser()
    await seed(user.profileId, 2)
    const list = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: user.token }),
      )
    ).json()
    const first = list[0]
    const markOne = await handleMarkRead(
      apiRequest(`/api/v1/notifications/${first.id}/read`, {
        method: 'POST',
        token: user.token,
      }),
      first.id,
    )
    expect(markOne.status).toBe(200)
    const markAll = await handleMarkAllRead(
      apiRequest('/api/v1/notifications/read-all', {
        method: 'POST',
        token: user.token,
      }),
    )
    expect(markAll.status).toBe(200)
    const clear = await handleClearRead(
      apiRequest('/api/v1/notifications/clear-read', {
        method: 'POST',
        token: user.token,
      }),
    )
    expect(clear.status).toBe(200)
    const remaining = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: user.token }),
      )
    ).json()
    expect(remaining).toHaveLength(0)
  })

  it("cannot mark another profile's notification read", async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    await seed(owner.profileId, 1)
    const list = await (
      await handleListNotifications(
        apiRequest('/api/v1/notifications', { token: owner.token }),
      )
    ).json()
    const res = await handleMarkRead(
      apiRequest(`/api/v1/notifications/${list[0].id}/read`, {
        method: 'POST',
        token: intruder.token,
      }),
      list[0].id,
    )
    // The impl scopes by profileId; expect a non-2xx (404 or 422 depending
    // on how the impl reports a missing row).
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
