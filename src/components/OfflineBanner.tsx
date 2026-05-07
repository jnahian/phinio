import { useEffect, useState } from 'react'
import {
  useIsMutating,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

/**
 * Surfaces network state and the offline mutation queue as sonner toasts
 * (so they overlay rather than shift page layout). Four states (later in
 * the list takes precedence):
 * - online + nothing pending + nothing errored → no toast.
 * - errored mutations present → red persistent toast with retry/discard.
 * - online + paused mutations replaying → blue loading toast.
 * - offline → amber persistent toast.
 *
 * Each state owns a stable toast id so re-renders update in place instead
 * of stacking new toasts.
 *
 * `useMutationState` reflects errored mutations even when nothing is
 * actively running, so the user has a path to retry server rejections that
 * happened during replay. Retrying calls `resumePausedMutations()` which
 * re-runs every paused/errored mutation; idempotency on the server side
 * guarantees a successful one isn't applied twice.
 *
 * QUEUE_CAP_WARNING surfaces a soft limit when the queue grows large.
 * IndexedDB has a generous quota, but writers eventually saturate when
 * the persisted blob hits a few megabytes; better to nudge the user
 * before the persister silently falls back to memory.
 */
const QUEUE_CAP_WARNING = 50

const TOAST_ID_OFFLINE = 'offline-state'
const TOAST_ID_SYNCING = 'offline-syncing'
const TOAST_ID_FAILED = 'offline-failed'

export function OfflineBanner() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  // Initialize to `true` on BOTH server and client first render to avoid a
  // hydration mismatch when the client mounts offline. The effect reconciles
  // with the real `navigator.onLine` after hydration.
  const [online, setOnline] = useState(true)
  const pendingCount = useIsMutating()
  // Mutation cache reflects errored entries even when nothing is running.
  const erroredCount = useMutationState({
    filters: { status: 'error' },
  }).length

  useEffect(() => {
    setOnline(navigator.onLine)
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Errored mutations — highest priority.
  useEffect(() => {
    if (erroredCount === 0) {
      toast.dismiss(TOAST_ID_FAILED)
      return
    }
    toast.error(t('offline.failed', { count: erroredCount }), {
      id: TOAST_ID_FAILED,
      duration: Infinity,
      action: {
        label: t('offline.retry'),
        onClick: () => {
          void queryClient.resumePausedMutations()
        },
      },
      cancel: {
        label: t('offline.discard'),
        onClick: () => {
          const cache = queryClient.getMutationCache()
          for (const m of cache.getAll()) {
            if (m.state.status === 'error') cache.remove(m)
          }
        },
      },
    })
  }, [erroredCount, queryClient, t])

  // Offline indicator.
  useEffect(() => {
    if (online) {
      toast.dismiss(TOAST_ID_OFFLINE)
      return
    }
    const overCap = pendingCount > QUEUE_CAP_WARNING
    toast.warning(
      overCap
        ? t('offline.queuedWithCount', { count: pendingCount })
        : t('offline.queuedShort'),
      { id: TOAST_ID_OFFLINE, duration: Infinity },
    )
  }, [online, pendingCount, t])

  // Syncing — only while online with active mutations. Defer briefly so
  // normal fast saves don't flash a toast.
  useEffect(() => {
    if (!online || pendingCount === 0 || erroredCount > 0) {
      toast.dismiss(TOAST_ID_SYNCING)
      return
    }
    const id = window.setTimeout(() => {
      toast.loading(t('offline.syncing', { count: pendingCount }), {
        id: TOAST_ID_SYNCING,
        duration: Infinity,
      })
    }, 600)
    return () => window.clearTimeout(id)
  }, [online, pendingCount, erroredCount, t])

  return null
}
