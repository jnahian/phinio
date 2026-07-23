import { beforeEach, describe, expect, it } from 'vitest'
import { handleRegisterDeviceToken } from '#/routes/api/v1/device-tokens'
import { handleDeleteDeviceToken } from '#/routes/api/v1/device-tokens.$token'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('device token REST routes', () => {
  it('registers a token for the caller profile', async () => {
    const user = await createAuthedUser()
    const res = await handleRegisterDeviceToken(
      apiRequest('/api/v1/device-tokens', {
        method: 'POST',
        token: user.token,
        body: { token: 'abc123devicetoken' },
      }),
    )
    expect(res.status).toBe(200)
    const row = await prisma.deviceToken.findUniqueOrThrow({
      where: { token: 'abc123devicetoken' },
    })
    expect(row.profileId).toBe(user.profileId)
    expect(row.platform).toBe('ios')
  })

  it('re-registering the same token moves it to the new profile', async () => {
    const first = await createAuthedUser()
    const second = await createAuthedUser()
    const register = (token: string) => (user: { token: string }) =>
      handleRegisterDeviceToken(
        apiRequest('/api/v1/device-tokens', {
          method: 'POST',
          token: user.token,
          body: { token },
        }),
      )
    await register('shared-device')(first)
    await register('shared-device')(second)
    const rows = await prisma.deviceToken.findMany({
      where: { token: 'shared-device' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].profileId).toBe(second.profileId)
  })

  it('DELETE removes only the caller-owned token', async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    await handleRegisterDeviceToken(
      apiRequest('/api/v1/device-tokens', {
        method: 'POST',
        token: owner.token,
        body: { token: 'delete-me' },
      }),
    )
    const foreign = await handleDeleteDeviceToken(
      apiRequest('/api/v1/device-tokens/delete-me', {
        method: 'DELETE',
        token: intruder.token,
      }),
      'delete-me',
    )
    expect((await foreign.json()).deleted).toBe(0)
    const own = await handleDeleteDeviceToken(
      apiRequest('/api/v1/device-tokens/delete-me', {
        method: 'DELETE',
        token: owner.token,
      }),
      'delete-me',
    )
    expect((await own.json()).deleted).toBe(1)
    expect(await prisma.deviceToken.count()).toBe(0)
  })
})
