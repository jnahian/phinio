import { beforeEach, describe, expect, it } from 'vitest'
import { handleCreateEmi, handleListEmis } from '#/routes/api/v1/emis.index'
import {
  handleDeleteEmi,
  handleGetEmi,
  handleUpdateEmi,
} from '#/routes/api/v1/emis.$emiId'
import { handleMarkPaymentPaid } from '#/routes/api/v1/emi-payments.$paymentId.mark-paid'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

const emiBody = {
  label: 'Car loan',
  type: 'bank_loan',
  principal: '100000',
  interestRate: '12',
  tenureMonths: 12,
  startDate: '2026-01-15',
}

describe('EMI REST routes', () => {
  it('POST /emis creates an EMI with its full schedule, money as strings', async () => {
    const user = await createAuthedUser()
    const res = await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: emiBody,
      }),
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(typeof created.principal).toBe('string')
    expect(created.principal).toBe('100000')
    const count = await prisma.emiPayment.count({
      where: { emiId: created.id },
    })
    expect(count).toBe(12)
  })

  it('POST /emis without a token is 401', async () => {
    const res = await handleCreateEmi(
      apiRequest('/api/v1/emis', { method: 'POST', body: emiBody }),
    )
    expect(res.status).toBe(401)
  })

  it('POST /emis with a bad payload is 400', async () => {
    const user = await createAuthedUser()
    const res = await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: { ...emiBody, principal: 'not-money' },
      }),
    )
    expect(res.status).toBe(400)
  })

  it('replays the same Idempotency-Key instead of duplicating', async () => {
    const user = await createAuthedUser()
    const key = crypto.randomUUID()
    const make = () =>
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: user.token,
        body: emiBody,
        idempotencyKey: key,
      })
    const first = await (await handleCreateEmi(make())).json()
    const second = await (await handleCreateEmi(make())).json()
    expect(second.id).toBe(first.id)
    expect(await prisma.emi.count()).toBe(1)
  })

  it('GET /emis lists own EMIs only and filters by query', async () => {
    const owner = await createAuthedUser()
    const other = await createAuthedUser()
    await handleCreateEmi(
      apiRequest('/api/v1/emis', {
        method: 'POST',
        token: owner.token,
        body: emiBody,
      }),
    )
    const mine = await (
      await handleListEmis(
        apiRequest('/api/v1/emis?status=active&type=bank_loan', {
          token: owner.token,
        }),
      )
    ).json()
    expect(mine).toHaveLength(1)
    const theirs = await (
      await handleListEmis(apiRequest('/api/v1/emis', { token: other.token }))
    ).json()
    expect(theirs).toHaveLength(0)
  })

  it("GET /emis/:id of another profile's EMI is 404", async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: owner.token,
          body: emiBody,
        }),
      )
    ).json()
    const res = await handleGetEmi(
      apiRequest(`/api/v1/emis/${created.id}`, { token: intruder.token }),
      created.id,
    )
    expect(res.status).toBe(404)
  })

  it('PATCH /emis/:id updates the label', async () => {
    const user = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: user.token,
          body: emiBody,
        }),
      )
    ).json()
    const res = await handleUpdateEmi(
      apiRequest(`/api/v1/emis/${created.id}`, {
        method: 'PATCH',
        token: user.token,
        body: { label: 'Renamed loan' },
      }),
      created.id,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).label).toBe('Renamed loan')
  })

  it('POST /emi-payments/:paymentId/mark-paid marks a payment paid', async () => {
    const user = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: user.token,
          body: emiBody,
        }),
      )
    ).json()
    const payment = await prisma.emiPayment.findFirstOrThrow({
      where: { emiId: created.id, paymentNumber: 1 },
    })
    const res = await handleMarkPaymentPaid(
      apiRequest(`/api/v1/emi-payments/${payment.id}/mark-paid`, {
        method: 'POST',
        token: user.token,
        body: { paid: true },
      }),
      payment.id,
    )
    expect(res.status).toBe(200)
    const after = await prisma.emiPayment.findUniqueOrThrow({
      where: { id: payment.id },
    })
    expect(after.status).toBe('paid')
  })

  it('DELETE /emis/:id deletes the EMI', async () => {
    const user = await createAuthedUser()
    const created = await (
      await handleCreateEmi(
        apiRequest('/api/v1/emis', {
          method: 'POST',
          token: user.token,
          body: emiBody,
        }),
      )
    ).json()
    const res = await handleDeleteEmi(
      apiRequest(`/api/v1/emis/${created.id}`, {
        method: 'DELETE',
        token: user.token,
      }),
      created.id,
    )
    expect(res.status).toBe(200)
    expect(await prisma.emi.count()).toBe(0)
  })
})
