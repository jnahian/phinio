import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { ActivityListResult } from './activity-log.impl'

export type { ActivityListResult }

// NOTE: This wrapper file must not statically import anything that pulls
// Prisma or Better Auth. See `./investments.ts` for the rationale.

const activityListQuerySchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).optional(),
})

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>

export const listActivityFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => activityListQuerySchema.parse(input))
  .handler(async ({ data }): Promise<ActivityListResult> => {
    const { requireProfileId, listActivityImpl } =
      await import('./activity-log.impl')
    return listActivityImpl(await requireProfileId(), data)
  })
