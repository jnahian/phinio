import NetInfo from '@react-native-community/netinfo'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Subscribe to connectivity changes. When the device transitions to a
 * fully-online state we resume any paused offline mutations and trigger
 * a one-shot invalidation so the user sees fresh data on reconnect.
 *
 * Profile-specific prefetching is intentionally deferred to Phase 4 —
 * here we keep the reconnect handler to a single invalidate-all tier.
 *
 * Returns an unsubscribe function the caller wires up in a useEffect
 * cleanup so we don't leak listeners across remounts.
 */
export function subscribeToConnectivity(queryClient: QueryClient): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      void queryClient.resumePausedMutations()
      void queryClient.invalidateQueries()
    }
  })
}
