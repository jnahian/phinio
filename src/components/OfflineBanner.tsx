import { useEffect, useState } from 'react'
import {
  useIsMutating,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CloudOff, RefreshCw } from 'lucide-react'

/**
 * Thin top banner that surfaces network state and the offline mutation
 * queue. Four states (later in the list takes precedence):
 * - online + nothing pending + nothing errored → render nothing.
 * - errored mutations present → red "N actions failed to sync" with retry.
 * - online + paused mutations replaying → blue "Syncing N changes…"
 * - offline → amber "You're offline. Changes will sync when you reconnect."
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

  // Defer the "Syncing…" banner so normal online saves (which finish in a
  // few hundred ms) don't briefly insert a top banner and shift the whole
  // page down. The banner is intended for paused-mutation replay after
  // reconnecting, which takes long enough to clear this threshold.
  const [showSyncing, setShowSyncing] = useState(false)
  useEffect(() => {
    if (pendingCount === 0 || !online) {
      setShowSyncing(false)
      return
    }
    const id = window.setTimeout(() => setShowSyncing(true), 600)
    return () => window.clearTimeout(id)
  }, [pendingCount, online])

  // Errored takes precedence so the user always has a retry path. After
  // a successful retry the cache clears these entries and the banner
  // either disappears or falls back to the offline / syncing variants.
  if (erroredCount > 0) {
    const handleRetry = () => {
      void queryClient.resumePausedMutations()
    }
    const handleDiscard = () => {
      const cache = queryClient.getMutationCache()
      for (const m of cache.getAll()) {
        if (m.state.status === 'error') cache.remove(m)
      }
    }
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="bg-red-950/40 text-red-100 border-b border-red-900/40 px-4 py-2 text-sm flex items-center gap-2 justify-center flex-wrap"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>{t('offline.failed', { count: erroredCount })}</span>
        <button
          type="button"
          onClick={handleRetry}
          className="underline underline-offset-2 hover:text-white"
        >
          {t('offline.retry')}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          className="underline underline-offset-2 hover:text-white"
        >
          {t('offline.discard')}
        </button>
      </div>
    )
  }

  if (!online) {
    const overCap = pendingCount > QUEUE_CAP_WARNING
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-950/40 text-amber-100 border-b border-amber-900/40 px-4 py-2 text-sm flex items-center gap-2 justify-center"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        <CloudOff className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>
          {overCap
            ? t('offline.queuedWithCount', { count: pendingCount })
            : t('offline.queuedShort')}
        </span>
      </div>
    )
  }

  if (pendingCount > 0 && showSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-blue-950/40 text-blue-100 border-b border-blue-900/40 px-4 py-2 text-sm flex items-center gap-2 justify-center"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        <RefreshCw
          className="h-4 w-4 shrink-0 animate-spin"
          strokeWidth={1.75}
        />
        <span>{t('offline.syncing', { count: pendingCount })}</span>
      </div>
    )
  }

  return null
}
