import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listNotificationsFn,
  markAllNotificationsReadFn,
  markNotificationReadFn,
  unreadNotificationCountFn,
} from '#/server/notifications'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => ['notifications', 'list'] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
}

export function notificationsListQueryOptions() {
  return queryOptions({
    queryKey: notificationKeys.list(),
    queryFn: () => listNotificationsFn(),
  })
}

export function useNotificationsQuery() {
  return useQuery(notificationsListQueryOptions())
}

export function useUnreadNotificationCountQuery() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => unreadNotificationCountFn(),
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationReadFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not mark as read')),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsReadFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not mark all read')),
  })
}
