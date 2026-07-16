import { beforeEach, describe, expect, it } from 'vitest'
import { handleGetProfile, handlePatchProfile } from '#/routes/api/v1/profile'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('profile REST routes', () => {
  it('GET /profile returns the caller profile', async () => {
    const user = await createAuthedUser()
    const res = await handleGetProfile(
      apiRequest('/api/v1/profile', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fullName).toBe('Rest Tester')
    expect(body.preferredCurrency).toBe('BDT')
  })

  it('PATCH /profile updates several fields in one call', async () => {
    const user = await createAuthedUser()
    const res = await handlePatchProfile(
      apiRequest('/api/v1/profile', {
        method: 'PATCH',
        token: user.token,
        body: { fullName: 'Renamed Person', preferredCurrency: 'USD' },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fullName).toBe('Renamed Person')
    expect(body.preferredCurrency).toBe('USD')
  })

  it('PATCH /profile with the same Idempotency-Key applies both fields (suffixed keys)', async () => {
    const user = await createAuthedUser()
    const key = crypto.randomUUID()
    const make = () =>
      apiRequest('/api/v1/profile', {
        method: 'PATCH',
        token: user.token,
        body: { fullName: 'Twice Patched', preferredLanguage: 'bn' },
        idempotencyKey: key,
      })
    await handlePatchProfile(make())
    const res = await handlePatchProfile(make())
    expect(res.status).toBe(200)
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { id: user.profileId },
    })
    expect(profile.fullName).toBe('Twice Patched')
    expect(profile.preferredLanguage).toBe('bn')
  })

  it('PATCH /profile rejects an unknown language', async () => {
    const user = await createAuthedUser()
    const res = await handlePatchProfile(
      apiRequest('/api/v1/profile', {
        method: 'PATCH',
        token: user.token,
        body: { preferredLanguage: 'xx' },
      }),
    )
    expect(res.status).toBe(400)
  })
})
