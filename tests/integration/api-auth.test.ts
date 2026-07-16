import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, api, requireApiProfile } from '#/server/api-v1'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('requireApiProfile', () => {
  it('resolves profileId and userId for a valid bearer token', async () => {
    const user = await createAuthedUser()
    const request = apiRequest('/api/v1/anything', { token: user.token })
    const result = await requireApiProfile(request)
    expect(result.profileId).toBe(user.profileId)
    expect(result.userId).toBe(user.userId)
  })

  it('throws ApiError 401 without a token', async () => {
    const request = apiRequest('/api/v1/anything')
    await expect(requireApiProfile(request)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('throws ApiError 401 for a garbage token', async () => {
    const request = apiRequest('/api/v1/anything', { token: 'not-a-token' })
    await expect(requireApiProfile(request)).rejects.toMatchObject({
      status: 401,
    })
  })
})

describe('api error mapping', () => {
  async function status(fn: () => Promise<unknown>) {
    const res = await api(fn)
    return res.status
  }

  it('serializes a successful result as JSON 200', async () => {
    const res = await api(async () => ({ hello: 'world' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toEqual({ hello: 'world' })
  })

  it('maps ApiError to its status and envelope', async () => {
    const res = await api(async () => {
      throw new ApiError(401, 'unauthorized', 'Unauthorized')
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Unauthorized' },
    })
  })

  it('maps ZodError to 400', async () => {
    const { z } = await import('zod')
    expect(await status(async () => z.string().parse(42))).toBe(400)
  })

  it("maps impl-style 'not found' errors to 404", async () => {
    expect(
      await status(async () => {
        throw new Error('EMI not found')
      }),
    ).toBe(404)
  })

  it("maps impl-style 'Unauthorized' errors to 401", async () => {
    expect(
      await status(async () => {
        throw new Error('Unauthorized')
      }),
    ).toBe(401)
  })

  it('maps business-rule errors to 422', async () => {
    expect(
      await status(async () => {
        throw new Error('Withdrawal amount exceeds current value')
      }),
    ).toBe(422)
  })
})
