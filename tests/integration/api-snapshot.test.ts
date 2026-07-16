import { beforeEach, describe, expect, it } from 'vitest'
import { handleSnapshot } from '#/routes/api/v1/sync.snapshot'
import { handleCreateEmi } from '#/routes/api/v1/emis.index'
import { handleCreateSavings } from '#/routes/api/v1/investments.savings'
import { resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/v1/sync/snapshot', () => {
  it('returns the full dataset scoped to the caller, money as strings', async () => {
    const user = await createAuthedUser()
    const other = await createAuthedUser()
    await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: {
          label: 'Snapshot loan',
          type: 'bank_loan',
          principal: '60000',
          interestRate: '9',
          tenureMonths: 6,
          startDate: '2026-01-01',
        },
      }),
    )
    await handleCreateSavings(
      apiRequest('/api/v1/investments/savings', {
        method: 'POST',
        token: other.token,
        body: { name: 'Other pot', startDate: '2026-01-01', currentValue: '5' },
      }),
    )

    const res = await handleSnapshot(
      apiRequest('/api/v1/sync/snapshot', { token: user.token }),
    )
    expect(res.status).toBe(200)
    const snap = await res.json()

    expect(snap.profile.id).toBe(user.profileId)
    expect(snap.emis).toHaveLength(1)
    expect(snap.emiPayments).toHaveLength(6)
    // Other profile's data must not leak.
    expect(snap.investments).toHaveLength(0)
    // Wire conventions: money strings, ISO dates, serverTime present.
    expect(typeof snap.emis[0].principal).toBe('string')
    expect(typeof snap.emiPayments[0].dueDate).toBe('string')
    expect(new Date(snap.serverTime).getTime()).not.toBeNaN()
  })

  it('is 401 without a token', async () => {
    const res = await handleSnapshot(apiRequest('/api/v1/sync/snapshot'))
    expect(res.status).toBe(401)
  })
})
