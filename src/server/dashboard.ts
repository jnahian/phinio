import { createServerFn } from '@tanstack/react-start'
import type { DashboardStats } from './dashboard.impl'

// Re-export the type so client hooks can consume it without pulling the impl.
export type { DashboardStats }

export const getDashboardStatsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardStats> => {
    const { requireProfileId, getDashboardStatsImpl } = await import(
      './dashboard.impl'
    )
    return getDashboardStatsImpl(await requireProfileId())
  },
)
