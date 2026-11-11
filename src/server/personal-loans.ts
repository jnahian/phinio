import { createServerFn } from '@tanstack/react-start'
import type { z } from 'zod'
import {
  addLoanRepaymentSchema,
  personalLoanCreateSchema,
  personalLoanIdSchema,
  personalLoanListQuerySchema,
  personalLoanUpdateSchema,
  removeLoanRepaymentSchema,
} from '#/lib/validators'

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. See `./investments.ts` for the rationale.

export const listPersonalLoansFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => personalLoanListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, listPersonalLoansImpl } =
      await import('./personal-loans.impl')
    return listPersonalLoansImpl(await requireProfileId(), data)
  })

export const getPersonalLoanFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => personalLoanIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, getPersonalLoanImpl } =
      await import('./personal-loans.impl')
    return getPersonalLoanImpl(await requireProfileId(), data.loanId)
  })

export const createPersonalLoanFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => personalLoanCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, createPersonalLoanImpl } =
      await import('./personal-loans.impl')
    return createPersonalLoanImpl(await requireProfileId(), data)
  })

export const updatePersonalLoanFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => personalLoanUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, updatePersonalLoanImpl } =
      await import('./personal-loans.impl')
    return updatePersonalLoanImpl(await requireProfileId(), data)
  })

export const deletePersonalLoanFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => personalLoanIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, deletePersonalLoanImpl } =
      await import('./personal-loans.impl')
    return deletePersonalLoanImpl(await requireProfileId(), data)
  })

export const addLoanRepaymentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => addLoanRepaymentSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, addLoanRepaymentImpl } =
      await import('./personal-loans.impl')
    return addLoanRepaymentImpl(await requireProfileId(), data)
  })

export const removeLoanRepaymentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => removeLoanRepaymentSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, removeLoanRepaymentImpl } =
      await import('./personal-loans.impl')
    return removeLoanRepaymentImpl(await requireProfileId(), data)
  })

export type PersonalLoanListFilters = z.infer<
  typeof personalLoanListQuerySchema
>
