import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { makeTRPC, useTRPC } from '#/lib/trpc'
import type { DashboardStats, UpcomingPaymentItem } from '@phinio/trpc'

export type { DashboardStats, UpcomingPaymentItem }

export function dashboardQueryOptions(queryClient: QueryClient) {
  return makeTRPC(queryClient).dashboard.stats.queryOptions()
}

export function useDashboardQuery() {
  const trpc = useTRPC()
  return useQuery(trpc.dashboard.stats.queryOptions())
}
