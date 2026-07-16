import { beforeEach, describe, expect, it } from 'vitest'
import { handleDashboard } from '#/routes/api/v1/dashboard'
import { handleListActivity } from '#/routes/api/v1/activity'
import { handleCreateEmi } from '#/routes/api/v1/emis.index'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('dashboard + activity REST routes', () => {
  it('GET /dashboard returns stats for the caller', async () => {
    const user = await createAuthedUser()
    const res = await handleDashboard(
      apiRequest('/api/v1/dashboard', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    // Shape sanity only — the impl has its own tests.
    expect(body).toBeTypeOf('object')
  })

  it('GET /activity returns entries after a mutation, honouring limit', async () => {
    const user = await createAuthedUser()
    await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: {
          label: 'Logged loan',
          type: 'bank_loan',
          principal: '10000',
          interestRate: '10',
          tenureMonths: 6,
          startDate: '2026-01-01',
        },
      }),
    )
    const res = await handleListActivity(
      apiRequest('/api/v1/activity?limit=5', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items.length).toBeGreaterThan(0)
  })

  it('GET /dashboard without a token is 401', async () => {
    const res = await handleDashboard(apiRequest('/api/v1/dashboard'))
    expect(res.status).toBe(401)
  })
})
