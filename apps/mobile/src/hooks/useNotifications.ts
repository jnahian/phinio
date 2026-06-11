import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { inferProcedureOutput } from '@trpc/server'
import type { AppRouter } from '@phinio/trpc'
import type {
  ClearReadNotificationsInput,
  MarkAllNotificationsReadInput,
  MarkNotificationReadInput,
} from '@phinio/validators'
import { makeTRPC, useTRPC } from '#/lib/trpc'
import { mutationKeys } from '#/lib/mutation-defaults'
import { notifyError } from '#/lib/notify'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

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

// ---------------------------------------------------------------------------
// Mutations — optimistic patches keyed via the tRPC proxy's queryKey()
// helpers so they target the entries the queries actually read (web's
// flat-key versions silently miss; see PR #38).
// ---------------------------------------------------------------------------

type NotificationListSnapshot =
  | inferProcedureOutput<AppRouter['notifications']['list']>
  | undefined
type UnreadCountSnapshot =
  | inferProcedureOutput<AppRouter['notifications']['unreadCount']>
  | undefined

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const listKey = trpc.notifications.list.queryKey()
  const countKey = trpc.notifications.unreadCount.queryKey()

  return useOfflineMutation<
    { id: string; updated: number },
    Error,
    MarkNotificationReadInput,
    { list: NotificationListSnapshot; count: UnreadCountSnapshot }
  >({
    mutationKey: mutationKeys.markNotificationRead,
    onMutate: async (input) => {
      await qc.cancelQueries(trpc.notifications.pathFilter())
      const list = qc.getQueryData(listKey)
      const count = qc.getQueryData(countKey)
      if (list) {
        qc.setQueryData(
          listKey,
          list.map((n) => (n.id === input.id ? { ...n, read: true } : n)),
        )
      }
      if (count && list?.find((n) => n.id === input.id && !n.read)) {
        qc.setQueryData(countKey, { count: Math.max(0, count.count - 1) })
      }
      return { list, count }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.list) qc.setQueryData(listKey, ctx.list)
      if (ctx?.count) qc.setQueryData(countKey, ctx.count)
      notifyError(err, 'Could not mark as read')
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.notifications.pathFilter())
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const listKey = trpc.notifications.list.queryKey()
  const countKey = trpc.notifications.unreadCount.queryKey()

  return useOfflineMutation<
    { updated: number },
    Error,
    MarkAllNotificationsReadInput,
    { list: NotificationListSnapshot; count: UnreadCountSnapshot }
  >({
    mutationKey: mutationKeys.markAllNotificationsRead,
    onMutate: async () => {
      await qc.cancelQueries(trpc.notifications.pathFilter())
      const list = qc.getQueryData(listKey)
      const count = qc.getQueryData(countKey)
      if (list) {
        qc.setQueryData(
          listKey,
          list.map((n) => ({ ...n, read: true })),
        )
      }
      qc.setQueryData(countKey, { count: 0 })
      return { list, count }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.list) qc.setQueryData(listKey, ctx.list)
      if (ctx?.count) qc.setQueryData(countKey, ctx.count)
      notifyError(err, 'Could not mark all read')
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.notifications.pathFilter())
    },
  })
}

export function useClearReadNotifications() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const listKey = trpc.notifications.list.queryKey()

  return useOfflineMutation<
    { deleted: number },
    Error,
    ClearReadNotificationsInput,
    { list: NotificationListSnapshot }
  >({
    mutationKey: mutationKeys.clearReadNotifications,
    onMutate: async () => {
      await qc.cancelQueries(trpc.notifications.pathFilter())
      const list = qc.getQueryData(listKey)
      if (list) {
        qc.setQueryData(
          listKey,
          list.filter((n) => !n.read),
        )
      }
      return { list }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.list) qc.setQueryData(listKey, ctx.list)
      notifyError(err, 'Could not clear notifications')
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.notifications.pathFilter())
    },
  })
}
