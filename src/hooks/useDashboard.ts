import { useQuery } from '@tanstack/react-query'
import { getDashboardStatsFn } from '#/server/dashboard'

export const dashboardKeys = {
  stats: ['dashboard-stats'] as const,
}

export function useDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: () => getDashboardStatsFn(),
  })
}
