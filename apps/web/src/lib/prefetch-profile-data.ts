import type { QueryClient } from '@tanstack/react-query'
import {
  investmentsListQueryOptions,
  investmentKeys,
} from '#/hooks/useInvestments'
import { emisListQueryOptions, emiKeys } from '#/hooks/useEmis'
import { dashboardQueryOptions } from '#/hooks/useDashboard'
import {
  notificationsListQueryOptions,
  unreadNotificationCountQueryOptions,
} from '#/hooks/useNotifications'
import { activityInfiniteQueryOptions } from '#/hooks/useActivityLog'
import { getInvestmentFn } from '#/server/investments'
import { getEmiFn } from '#/server/emis'

// Prefetch the filter combinations users routinely view. Anything beyond
// these is on-demand — re-fetching every possible filter on each reconnect
// would be wasteful, and TanStack Query satisfies less-common views from
// the network when the user navigates to them.
const INVESTMENT_FILTERS = [
  { status: 'active' as const, type: 'all' as const },
  { status: 'completed' as const, type: 'all' as const },
] as const
const EMI_FILTERS = [
  { type: 'all' as const, status: 'active' as const },
  { type: 'all' as const, status: 'completed' as const },
] as const

// Coalesce reconnect events: TanStack Query already respects per-query
// staleTime, but firing 100+ prefetch requests on every focus/online flip
// is still rude. Skip if the last successful prefetch finished within
// PREFETCH_COOLDOWN_MS. Bumped on each successful run.
const PREFETCH_COOLDOWN_MS = 5 * 60_000
const lastPrefetchByClient = new WeakMap<QueryClient, number>()

type InvestmentRow = { id: string }
type EmiRow = { id: string }

export async function prefetchProfileData(queryClient: QueryClient) {
  const last = lastPrefetchByClient.get(queryClient) ?? 0
  if (Date.now() - last < PREFETCH_COOLDOWN_MS) return

  const tasks: Array<Promise<unknown>> = [
    queryClient.prefetchQuery(dashboardQueryOptions()),
    queryClient.prefetchQuery(notificationsListQueryOptions()),
    queryClient.prefetchQuery(unreadNotificationCountQueryOptions()),
    queryClient.prefetchInfiniteQuery(activityInfiniteQueryOptions()),
    ...INVESTMENT_FILTERS.map((f) =>
      queryClient.prefetchQuery(investmentsListQueryOptions(f)),
    ),
    ...EMI_FILTERS.map((f) =>
      queryClient.prefetchQuery(emisListQueryOptions(queryClient, f)),
    ),
  ]
  await Promise.allSettled(tasks)

  // Detail prefetch only walks the active list to keep the fan-out
  // bounded. Completed/closed lists are usually small but rarely opened
  // from a fresh launch, so warming them as detail pages too rarely pays
  // off. The lists themselves are cached above.
  const investments =
    queryClient.getQueryData<Array<InvestmentRow>>(
      investmentKeys.list(INVESTMENT_FILTERS[0]),
    ) ?? []
  const emis =
    queryClient.getQueryData<Array<EmiRow>>(emiKeys.list(EMI_FILTERS[0])) ?? []

  await pMapLimit(investments, 4, (row) =>
    queryClient.prefetchQuery({
      queryKey: investmentKeys.detail(row.id),
      queryFn: () => getInvestmentFn({ data: { id: row.id } }),
    }),
  )
  await pMapLimit(emis, 4, (row) =>
    queryClient.prefetchQuery({
      queryKey: emiKeys.detail(row.id),
      queryFn: () => getEmiFn({ data: { emiId: row.id } }),
    }),
  )

  lastPrefetchByClient.set(queryClient, Date.now())
}

/**
 * Reset the cooldown — call after sign-out / sign-in so the new user
 * gets a fresh prefetch even if the previous user's prefetch was recent.
 */
export function resetPrefetchCooldown(queryClient: QueryClient) {
  lastPrefetchByClient.delete(queryClient)
}

async function pMapLimit<T>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const i = cursor++
        try {
          await fn(items[i])
        } catch {
          // Per-item failure shouldn't abort the warm-up.
        }
      }
    })(),
  )
  await Promise.all(workers)
}
