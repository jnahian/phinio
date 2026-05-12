import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { listActivityFn } from '#/server/activity-log'
import type { ActivityListResult } from '#/server/activity-log'

export const activityKeys = {
  all: ['activity'] as const,
  list: () => ['activity', 'list'] as const,
}

export function activityInfiniteQueryOptions() {
  return infiniteQueryOptions<
    ActivityListResult,
    Error,
    { pages: Array<ActivityListResult>; pageParams: Array<string | null> },
    ReturnType<typeof activityKeys.list>,
    string | null
  >({
    queryKey: activityKeys.list(),
    queryFn: ({ pageParam }) =>
      listActivityFn({ data: { cursor: pageParam ?? null, limit: 15 } }),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor,
  })
}

export function useActivityLogQuery() {
  return useInfiniteQuery(activityInfiniteQueryOptions())
}

export function useInvalidateActivity() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: activityKeys.all })
}
