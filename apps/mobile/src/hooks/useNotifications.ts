import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { makeTRPC, useTRPC } from '#/lib/trpc'

// Poll every five minutes so a server-created notification (cron) shows up
// without a manual refresh. Mirrors apps/web.
const REFETCH_INTERVAL_MS = 5 * 60_000

export function notificationsListQueryOptions(queryClient: QueryClient) {
  return {
    ...makeTRPC(queryClient).notifications.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL_MS,
  }
}

export function useNotificationsQuery() {
  const trpc = useTRPC()
  return useQuery({
    ...trpc.notifications.list.queryOptions(),
    refetchInterval: REFETCH_INTERVAL_MS,
  })
}

export function unreadNotificationCountQueryOptions(queryClient: QueryClient) {
  return {
    ...makeTRPC(queryClient).notifications.unreadCount.queryOptions(),
    refetchInterval: REFETCH_INTERVAL_MS,
  }
}

export function useUnreadNotificationCountQuery() {
  const trpc = useTRPC()
  return useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchInterval: REFETCH_INTERVAL_MS,
  })
}
