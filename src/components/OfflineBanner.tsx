import { useEffect, useState } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { CloudOff, RefreshCw } from 'lucide-react'

/**
 * Thin top banner that surfaces network state and the offline mutation
 * queue. Three states:
 * - online + nothing pending → render nothing.
 * - online + paused mutations replaying → "Syncing N changes…"
 * - offline → "You're offline. Changes will sync when you reconnect."
 *
 * The banner reads `navigator.onLine` at mount, then listens for the
 * `online` and `offline` events. `useIsMutating` reflects both
 * actively-running and paused mutations, so the count includes the queue
 * waiting on reconnect.
 */
export function OfflineBanner() {
  // `window` is reliably undefined during SSR; modern Node exposes a global
  // `navigator.onLine` that defaults to `false`, which would render an
  // "offline" banner on every server-rendered page.
  const [online, setOnline] = useState(() =>
    typeof window === 'undefined' ? true : navigator.onLine,
  )
  const pendingCount = useIsMutating()

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online && pendingCount === 0) return null

  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-amber-950/40 text-amber-100 border-b border-amber-900/40 px-4 py-2 text-sm flex items-center gap-2 justify-center"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
        <CloudOff className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>You're offline. Changes will sync when you reconnect.</span>
      </div>
    )
  }

  // Online but the queue is non-empty — typically just landed back online
  // and the reconnect handler is flushing.
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-blue-950/40 text-blue-100 border-b border-blue-900/40 px-4 py-2 text-sm flex items-center gap-2 justify-center"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
    >
      <RefreshCw className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.75} />
      <span>
        Syncing {pendingCount} {pendingCount === 1 ? 'change' : 'changes'}…
      </span>
    </div>
  )
}
