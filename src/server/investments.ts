import { createServerFn } from '@tanstack/react-start'
import type { z } from 'zod'
import {
  investmentCreateSchema,
  investmentIdSchema,
  investmentListQuerySchema,
  investmentUpdateSchema,
} from '#/lib/validators'

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. Those imports live in `./investments.impl` and are
// loaded only inside handler bodies via dynamic import, so the TanStack Start
// transform can strip the server code from the client bundle.

export const listInvestmentsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => investmentListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, listInvestmentsImpl } = await import(
      './investments.impl'
    )
    return listInvestmentsImpl(await requireProfileId(), data)
  })

export const getInvestmentFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => investmentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, getInvestmentImpl } = await import(
      './investments.impl'
    )
    return getInvestmentImpl(await requireProfileId(), data.id)
  })

export const createInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, createInvestmentImpl } = await import(
      './investments.impl'
    )
    return createInvestmentImpl(await requireProfileId(), data)
  })

export const updateInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, updateInvestmentImpl } = await import(
      './investments.impl'
    )
    return updateInvestmentImpl(await requireProfileId(), data)
  })

export const deleteInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => investmentIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, deleteInvestmentImpl } = await import(
      './investments.impl'
    )
    return deleteInvestmentImpl(await requireProfileId(), data.id)
  })

export type InvestmentListFilters = z.infer<typeof investmentListQuerySchema>
