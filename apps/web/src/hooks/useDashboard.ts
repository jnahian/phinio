import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { makeTRPC, useTRPC } from '#/lib/trpc'
import type { DashboardStats } from '@phinio/trpc'

export type { DashboardStats }

/**
 * Invalidation keys for the dashboard domain. tRPC stores cache entries
 * under `[pathArray, meta]` keys, so a cross-domain invalidation filter
 * must be `[['dashboard', 'stats']]` — a bare `['dashboard-stats']` style
 * flat key would silently match nothing.
 */
export const dashboardKeys = {
  stats: [['dashboard', 'stats']] as const,
}

export function dashboardQueryOptions(queryClient: QueryClient) {
  return makeTRPC(queryClient).dashboard.stats.queryOptions()
}

export function useDashboardQuery() {
  const trpc = useTRPC()
  return useQuery(trpc.dashboard.stats.queryOptions())
}
