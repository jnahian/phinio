import { createServerFn } from '@tanstack/react-start'
import type { z } from 'zod'
import {
  investmentCreateSchema,
  investmentIdSchema,
  investmentListQuerySchema,
  investmentUpdateSchema,
  dpsCreateSchema,
  dpsUpdateSchema,
  markDepositPaidSchema,
  savingsCreateSchema,
  savingsUpdateSchema,
  addDepositSchema,
  removeDepositSchema,
  withdrawalSchema,
  dpsCloseSchema,
} from '#/lib/validators'

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. Those imports live in `./investments.impl` and are
// loaded only inside handler bodies via dynamic import, so the TanStack Start
// transform can strip the server code from the client bundle.

// ---------------------------------------------------------------------------
// List + detail (unified)
// ---------------------------------------------------------------------------

export const listInvestmentsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => investmentListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, listInvestmentsImpl } =
      await import('./investments.impl')
    return listInvestmentsImpl(await requireProfileId(), data)
  })

export const getInvestmentFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => investmentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, getInvestmentImpl } =
      await import('./investments.impl')
    return getInvestmentImpl(await requireProfileId(), data.id)
  })

// ---------------------------------------------------------------------------
// Lump-sum CRUD
// ---------------------------------------------------------------------------

export const createInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, createInvestmentImpl } =
      await import('./investments.impl')
    return createInvestmentImpl(await requireProfileId(), data)
  })

export const updateInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, updateInvestmentImpl } =
      await import('./investments.impl')
    return updateInvestmentImpl(await requireProfileId(), data)
  })

export const deleteInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, deleteInvestmentImpl } =
      await import('./investments.impl')
    return deleteInvestmentImpl(await requireProfileId(), data.id)
  })

// ---------------------------------------------------------------------------
// DPS (scheduled)
// ---------------------------------------------------------------------------

export const createDpsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => dpsCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, createDpsInvestmentImpl } =
      await import('./investments.impl')
    return createDpsInvestmentImpl(await requireProfileId(), data)
  })

export const updateDpsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => dpsUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, updateDpsInvestmentImpl } =
      await import('./investments.impl')
    return updateDpsInvestmentImpl(await requireProfileId(), data)
  })

export const markDepositPaidFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => markDepositPaidSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, markDepositPaidImpl } =
      await import('./investments.impl')
    return markDepositPaidImpl(await requireProfileId(), data)
  })

// ---------------------------------------------------------------------------
// Savings (flexible)
// ---------------------------------------------------------------------------

export const createSavingsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => savingsCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, createSavingsInvestmentImpl } =
      await import('./investments.impl')
    return createSavingsInvestmentImpl(await requireProfileId(), data)
  })

export const updateSavingsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => savingsUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, updateSavingsInvestmentImpl } =
      await import('./investments.impl')
    return updateSavingsInvestmentImpl(await requireProfileId(), data)
  })

export const addDepositFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => addDepositSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, addDepositImpl } =
      await import('./investments.impl')
    return addDepositImpl(await requireProfileId(), data)
  })

export const removeDepositFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => removeDepositSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, removeDepositImpl } =
      await import('./investments.impl')
    return removeDepositImpl(await requireProfileId(), data)
  })

export const deleteSavingsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, deleteInvestmentImpl } =
      await import('./investments.impl')
    return deleteInvestmentImpl(await requireProfileId(), data.id)
  })

// ---------------------------------------------------------------------------
// Withdrawals (lump_sum + flexible) and DPS premature closure
// ---------------------------------------------------------------------------

export const withdrawFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => withdrawalSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, withdrawImpl } =
      await import('./investments.impl')
    return withdrawImpl(await requireProfileId(), data)
  })

export const closeDpsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => dpsCloseSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, closeDpsImpl } =
      await import('./investments.impl')
    return closeDpsImpl(await requireProfileId(), data)
  })

export type InvestmentListFilters = z.infer<typeof investmentListQuerySchema>
