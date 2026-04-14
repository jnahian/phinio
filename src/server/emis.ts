import { createServerFn } from '@tanstack/react-start'
import type { z } from 'zod'
import {
  emiCreateSchema,
  emiIdSchema,
  emiListQuerySchema,
  markPaymentPaidSchema,
} from '#/lib/validators'

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. See `./investments.ts` for the rationale.

export const listEmisFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => emiListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, listEmisImpl } = await import('./emis.impl')
    return listEmisImpl(await requireProfileId(), data)
  })

export const getEmiFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => emiIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, getEmiImpl } = await import('./emis.impl')
    return getEmiImpl(await requireProfileId(), data.emiId)
  })

export const createEmiFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => emiCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, createEmiImpl } = await import('./emis.impl')
    return createEmiImpl(await requireProfileId(), data)
  })

export const deleteEmiFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => emiIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, deleteEmiImpl } = await import('./emis.impl')
    return deleteEmiImpl(await requireProfileId(), data.emiId)
  })

export const markPaymentPaidFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => markPaymentPaidSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, markPaymentPaidImpl } =
      await import('./emis.impl')
    return markPaymentPaidImpl(await requireProfileId(), data)
  })

export const upcomingPaymentsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { requireProfileId, upcomingPaymentsImpl } =
      await import('./emis.impl')
    return upcomingPaymentsImpl(await requireProfileId())
  },
)

export type EmiListFilters = z.infer<typeof emiListQuerySchema>
