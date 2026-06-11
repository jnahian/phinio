import { useInfiniteQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { ActivityListResult } from '@phinio/trpc/activity-log'
import { makeTRPC, useTRPC } from '#/lib/trpc'

export type { ActivityListResult }

const PAGE_SIZE = 15

export function activityInfiniteQueryOptions(queryClient: QueryClient) {
  return makeTRPC(queryClient).activity.list.infiniteQueryOptions(
    { limit: PAGE_SIZE },
    {
      initialCursor: null as string | null,
      getNextPageParam: (last: ActivityListResult) => last.nextCursor,
    },
  )
}

export function useActivityQuery() {
  const trpc = useTRPC()
  return useInfiniteQuery(
    trpc.activity.list.infiniteQueryOptions(
      { limit: PAGE_SIZE },
      {
        initialCursor: null as string | null,
        getNextPageParam: (last: ActivityListResult) => last.nextCursor,
      },
    ),
  )
}
