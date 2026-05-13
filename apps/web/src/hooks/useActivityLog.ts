import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { makeTRPC, useTRPC } from '#/lib/trpc'
import type { ActivityListResult } from '@phinio/trpc/activity-log'

export type { ActivityListResult }

export const activityKeys = {
  all: ['activity'] as const,
  list: () => ['activity', 'list'] as const,
}

export function activityInfiniteQueryOptions(queryClient: QueryClient) {
  return makeTRPC(queryClient).activity.list.infiniteQueryOptions(
    { limit: 15 },
    {
      initialCursor: null as string | null,
      getNextPageParam: (last: ActivityListResult) => last.nextCursor,
    },
  )
}

export function useActivityLogQuery() {
  const trpc = useTRPC()
  return useInfiniteQuery(
    trpc.activity.list.infiniteQueryOptions(
      { limit: 15 },
      {
        initialCursor: null as string | null,
        getNextPageParam: (last: ActivityListResult) => last.nextCursor,
      },
    ),
  )
}

export function useInvalidateActivity() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: activityKeys.all })
}
