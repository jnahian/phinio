import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listNotificationsFn,
  unreadNotificationCountFn,
} from '#/server/notifications'
import type {
  ClearReadNotificationsInput,
  MarkAllNotificationsReadInput,
  MarkNotificationReadInput,
} from '@phinio/validators'
import { mutationKeys } from '#/integrations/tanstack-query/mutation-defaults'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

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
    refetchInterval: 5 * 60_000,
  })
}

export function useNotificationsQuery() {
  return useQuery(notificationsListQueryOptions())
}

export function unreadNotificationCountQueryOptions() {
  return queryOptions({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => unreadNotificationCountFn(),
    refetchInterval: 5 * 60_000,
  })
}

export function useUnreadNotificationCountQuery() {
  return useQuery(unreadNotificationCountQueryOptions())
}

type NotificationItem = { id: string; read: boolean }
type NotificationListSnapshot = Array<NotificationItem> | undefined
type UnreadCountSnapshot = { count: number } | undefined

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { id: string; updated: number },
    Error,
    MarkNotificationReadInput,
    { list: NotificationListSnapshot; count: UnreadCountSnapshot }
  >({
    mutationKey: mutationKeys.markNotificationRead,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all })
      const list = qc.getQueryData<NotificationListSnapshot>(
        notificationKeys.list(),
      )
      const count = qc.getQueryData<UnreadCountSnapshot>(
        notificationKeys.unreadCount(),
      )
      if (list) {
        qc.setQueryData<NotificationListSnapshot>(
          notificationKeys.list(),
          list.map((n) => (n.id === input.id ? { ...n, read: true } : n)),
        )
      }
      if (count && list?.find((n) => n.id === input.id && !n.read)) {
        qc.setQueryData<UnreadCountSnapshot>(notificationKeys.unreadCount(), {
          count: Math.max(0, count.count - 1),
        })
      }
      return { list, count }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.list) qc.setQueryData(notificationKeys.list(), ctx.list)
      if (ctx?.count) qc.setQueryData(notificationKeys.unreadCount(), ctx.count)
      toast.error(errorMessage(err, 'Could not mark as read'))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useClearReadNotifications() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { deleted: number },
    Error,
    ClearReadNotificationsInput,
    { list: NotificationListSnapshot }
  >({
    mutationKey: mutationKeys.clearReadNotifications,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all })
      const list = qc.getQueryData<NotificationListSnapshot>(
        notificationKeys.list(),
      )
      if (list) {
        qc.setQueryData<NotificationListSnapshot>(
          notificationKeys.list(),
          list.filter((n) => !n.read),
        )
      }
      return { list }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.list) qc.setQueryData(notificationKeys.list(), ctx.list)
      toast.error(errorMessage(err, 'Could not clear notifications'))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { updated: number },
    Error,
    MarkAllNotificationsReadInput,
    { list: NotificationListSnapshot; count: UnreadCountSnapshot }
  >({
    mutationKey: mutationKeys.markAllNotificationsRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all })
      const list = qc.getQueryData<NotificationListSnapshot>(
        notificationKeys.list(),
      )
      const count = qc.getQueryData<UnreadCountSnapshot>(
        notificationKeys.unreadCount(),
      )
      if (list) {
        qc.setQueryData<NotificationListSnapshot>(
          notificationKeys.list(),
          list.map((n) => ({ ...n, read: true })),
        )
      }
      qc.setQueryData<UnreadCountSnapshot>(notificationKeys.unreadCount(), {
        count: 0,
      })
      return { list, count }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.list) qc.setQueryData(notificationKeys.list(), ctx.list)
      if (ctx?.count) qc.setQueryData(notificationKeys.unreadCount(), ctx.count)
      toast.error(errorMessage(err, 'Could not mark all read'))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
