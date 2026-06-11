import type { QueryClient } from '@tanstack/react-query'
import { dashboardQueryOptions } from '#/hooks/useDashboard'
import { investmentsListQueryOptions } from '#/hooks/useInvestments'
import { emisListQueryOptions } from '#/hooks/useEmis'
import {
  notificationsListQueryOptions,
  unreadNotificationCountQueryOptions,
} from '#/hooks/useNotifications'
import { activityInfiniteQueryOptions } from '#/hooks/useActivity'
import { profileQueryOptions } from '#/hooks/useProfile'

// Prefetch the filter combinations users routinely view — mirrors
// apps/web/src/lib/prefetch-profile-data.ts minus the per-detail fan-out
// (detail screens land in Phase 4D; revisit the fan-out once their usage
// is real). Anything beyond these is fetched on-demand on navigation.
const INVESTMENT_FILTERS = [
  { status: 'active' as const, type: 'all' as const },
  { status: 'completed' as const, type: 'all' as const },
] as const
const EMI_FILTERS = [
  { type: 'all' as const, status: 'active' as const },
  { type: 'all' as const, status: 'completed' as const },
] as const

// Coalesce reconnect events: TanStack Query already respects per-query
// staleTime, but re-firing the whole fan-out on every connectivity flip
// is still rude. Skip if the last successful prefetch finished within
// PREFETCH_COOLDOWN_MS. Bumped on each successful run.
const PREFETCH_COOLDOWN_MS = 5 * 60_000
const lastPrefetchByClient = new WeakMap<QueryClient, number>()

export async function prefetchProfileData(queryClient: QueryClient) {
  const last = lastPrefetchByClient.get(queryClient) ?? 0
  if (Date.now() - last < PREFETCH_COOLDOWN_MS) return

  const tasks: Promise<unknown>[] = [
    queryClient.prefetchQuery(profileQueryOptions(queryClient)),
    queryClient.prefetchQuery(dashboardQueryOptions(queryClient)),
    queryClient.prefetchQuery(notificationsListQueryOptions(queryClient)),
    queryClient.prefetchQuery(unreadNotificationCountQueryOptions(queryClient)),
    queryClient.prefetchInfiniteQuery(activityInfiniteQueryOptions(queryClient)),
    ...INVESTMENT_FILTERS.map((f) =>
      queryClient.prefetchQuery(investmentsListQueryOptions(queryClient, f)),
    ),
    ...EMI_FILTERS.map((f) =>
      queryClient.prefetchQuery(emisListQueryOptions(queryClient, f)),
    ),
  ]

  await Promise.allSettled(tasks)
  lastPrefetchByClient.set(queryClient, Date.now())
}
