import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { dashboardKeys, dashboardQueryOptions } from '#/hooks/useDashboard'

describe('dashboardKeys', () => {
  it('prefix-matches the query key the tRPC options proxy generates', () => {
    const queryClient = new QueryClient()
    const options = dashboardQueryOptions(queryClient)

    // Seed a cache entry under the real tRPC key, then assert the
    // invalidation filter used by useEmis/useInvestments actually hits it.
    // Guards against the flat-key mismatch that silently no-ops
    // (`['dashboard-stats']` vs `[['dashboard','stats'], ...]`).
    queryClient.setQueryData(options.queryKey, {})
    const matched = queryClient.getQueryCache().findAll({
      queryKey: dashboardKeys.stats,
    })
    expect(matched).toHaveLength(1)
  })
})
