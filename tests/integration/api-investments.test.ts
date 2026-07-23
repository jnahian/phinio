import { beforeEach, describe, expect, it } from 'vitest'
import {
  handleCreateInvestment,
  handleListInvestments,
} from '#/routes/api/v1/investments.index'
import {
  handleDeleteInvestment,
  handleGetInvestment,
} from '#/routes/api/v1/investments.$id'
import { handleWithdraw } from '#/routes/api/v1/investments.$id.withdraw'
import { handleCreateSavings } from '#/routes/api/v1/investments.savings'
import { handleAddDeposit } from '#/routes/api/v1/investments.savings.$id.deposits'
import { handleCreateDps } from '#/routes/api/v1/investments.dps'
import { handleMarkDepositPaid } from '#/routes/api/v1/deposits.$depositId.mark-paid'
import { prisma, resetDb } from './helpers/db'
import { apiRequest, createAuthedUser } from './helpers/rest'

beforeEach(async () => {
  await resetDb()
})

describe('investment REST routes', () => {
  it('POST /investments creates a lump-sum investment, money as strings', async () => {
    const user = await createAuthedUser()
    const res = await handleCreateInvestment(
      apiRequest('/api/v1/investments', {
        method: 'POST',
        token: user.token,
        body: {
          name: 'Index fund',
          type: 'mutual_fund',
          investedAmount: '50000',
          currentValue: '52000',
          dateOfInvestment: '2026-01-01',
        },
      }),
    )
    expect(res.status).toBe(200)
    const created = await res.json()
    expect(typeof created.investedAmount).toBe('string')
  })

  it('GET /investments filters by query and scopes to the profile', async () => {
    const user = await createAuthedUser()
    const other = await createAuthedUser()
    await handleCreateInvestment(
      apiRequest('/api/v1/investments', {
        method: 'POST',
        token: user.token,
        body: {
          name: 'Gold',
          type: 'gold',
          investedAmount: '10000',
          currentValue: '11000',
          dateOfInvestment: '2026-02-01',
        },
      }),
    )
    const mine = await (
      await handleListInvestments(
        apiRequest('/api/v1/investments?status=active&type=gold', {
          token: user.token,
        }),
      )
    ).json()
    expect(mine).toHaveLength(1)
    const theirs = await (
      await handleListInvestments(
        apiRequest('/api/v1/investments', { token: other.token }),
      )
    ).json()
    expect(theirs).toHaveLength(0)
  })

  it('savings: create, add deposit, then partial withdraw', async () => {
    const user = await createAuthedUser()
    const savings = await (
      await handleCreateSavings(
        apiRequest('/api/v1/investments/savings', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Rainy day',
            startDate: '2026-01-01',
            currentValue: '0',
          },
        }),
      )
    ).json()
    const dep = await handleAddDeposit(
      apiRequest(`/api/v1/investments/savings/${savings.id}/deposits`, {
        method: 'POST',
        token: user.token,
        body: { amount: '5000', depositDate: '2026-02-01' },
      }),
      savings.id,
    )
    expect(dep.status).toBe(200)
    const withdrawal = await handleWithdraw(
      apiRequest(`/api/v1/investments/${savings.id}/withdraw`, {
        method: 'POST',
        token: user.token,
        body: { amount: '2000', withdrawalDate: '2026-03-01' },
      }),
      savings.id,
    )
    expect(withdrawal.status).toBe(200)
  })

  it('withdrawing more than current value is a 422', async () => {
    const user = await createAuthedUser()
    const savings = await (
      await handleCreateSavings(
        apiRequest('/api/v1/investments/savings', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Small pot',
            startDate: '2026-01-01',
            currentValue: '100',
          },
        }),
      )
    ).json()
    const res = await handleWithdraw(
      apiRequest(`/api/v1/investments/${savings.id}/withdraw`, {
        method: 'POST',
        token: user.token,
        body: { amount: '99999', withdrawalDate: '2026-03-01' },
      }),
      savings.id,
    )
    expect(res.status).toBe(422)
  })

  it('dps: create generates the deposit schedule; mark one paid', async () => {
    const user = await createAuthedUser()
    const dps = await (
      await handleCreateDps(
        apiRequest('/api/v1/investments/dps', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Bank DPS',
            monthlyDeposit: '5000',
            tenureMonths: 12,
            interestRate: '6',
            interestType: 'simple',
            startDate: '2026-01-10',
          },
        }),
      )
    ).json()
    const deposits = await prisma.investmentDeposit.findMany({
      where: { investmentId: dps.id },
      orderBy: { dueDate: 'asc' },
    })
    expect(deposits).toHaveLength(12)
    const res = await handleMarkDepositPaid(
      apiRequest(`/api/v1/deposits/${deposits[0].id}/mark-paid`, {
        method: 'POST',
        token: user.token,
        body: { paid: true },
      }),
      deposits[0].id,
    )
    expect(res.status).toBe(200)
  })

  it("GET /investments/:id of someone else's investment is 404", async () => {
    const owner = await createAuthedUser()
    const intruder = await createAuthedUser()
    const inv = await (
      await handleCreateInvestment(
        apiRequest('/api/v1/investments', {
          method: 'POST',
          token: owner.token,
          body: {
            name: 'Stocks',
            type: 'stock',
            investedAmount: '1000',
            currentValue: '1000',
            dateOfInvestment: '2026-01-01',
          },
        }),
      )
    ).json()
    const res = await handleGetInvestment(
      apiRequest(`/api/v1/investments/${inv.id}`, { token: intruder.token }),
      inv.id,
    )
    expect(res.status).toBe(404)
  })

  it('DELETE /investments/:id removes it', async () => {
    const user = await createAuthedUser()
    const inv = await (
      await handleCreateInvestment(
        apiRequest('/api/v1/investments', {
          method: 'POST',
          token: user.token,
          body: {
            name: 'Crypto',
            type: 'crypto',
            investedAmount: '500',
            currentValue: '400',
            dateOfInvestment: '2026-01-01',
          },
        }),
      )
    ).json()
    const res = await handleDeleteInvestment(
      apiRequest(`/api/v1/investments/${inv.id}`, {
        method: 'DELETE',
        token: user.token,
      }),
      inv.id,
    )
    expect(res.status).toBe(200)
    expect(await prisma.investment.count()).toBe(0)
  })
})
