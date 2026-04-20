import { queryOptions, useQuery } from '@tanstack/react-query'
import { getDashboardStatsFn } from '#/server/dashboard'

export const dashboardKeys = {
  stats: ['dashboard-stats'] as const,
}

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: dashboardKeys.stats,
    queryFn: () => getDashboardStatsFn(),
  })
}

export function useDashboardQuery() {
  return useQuery(dashboardQueryOptions())
}
