import { createServerFn } from '@tanstack/react-start'
import {
  dpsCreateSchema,
  dpsIdSchema,
  dpsListQuerySchema,
  dpsUpdateSchema,
  markDpsInstallmentPaidSchema,
} from '#/lib/validators'

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. Those imports live in `./dps.impl` and are
// loaded only inside handler bodies via dynamic import.

export const listDpsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => dpsListQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, listDpsImpl } = await import('./dps.impl')
    return listDpsImpl(await requireProfileId(), data)
  })

export const getDpsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => dpsIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, getDpsImpl } = await import('./dps.impl')
    return getDpsImpl(await requireProfileId(), data.dpsId)
  })

export const createDpsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => dpsCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, createDpsImpl } = await import('./dps.impl')
    return createDpsImpl(await requireProfileId(), data)
  })

export const updateDpsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => dpsUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, updateDpsImpl } = await import('./dps.impl')
    return updateDpsImpl(await requireProfileId(), data)
  })

export const deleteDpsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => dpsIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, deleteDpsImpl } = await import('./dps.impl')
    return deleteDpsImpl(await requireProfileId(), data.dpsId)
  })

export const markDpsInstallmentPaidFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => markDpsInstallmentPaidSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireProfileId, markDpsInstallmentPaidImpl } =
      await import('./dps.impl')
    return markDpsInstallmentPaidImpl(await requireProfileId(), data)
  })
