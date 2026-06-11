import NetInfo from '@react-native-community/netinfo'
import type { QueryClient } from '@tanstack/react-query'
import { getSessionToken } from './auth'
import { prefetchProfileData } from './prefetch-profile-data'

/**
 * Subscribe to connectivity changes. When the device transitions to a
 * fully-online state we resume any paused offline mutations, trigger
 * a one-shot invalidation so the user sees fresh data on reconnect,
 * then warm the caches the tabs read (dashboard, lists, notifications)
 * — but only when a session exists; an unauthenticated reconnect has
 * nothing useful to prefetch and every call would 401.
 *
 * Returns an unsubscribe function the caller wires up in a useEffect
 * cleanup so we don't leak listeners across remounts.
 */
export function subscribeToConnectivity(queryClient: QueryClient): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      void (async () => {
        await queryClient.resumePausedMutations()
        await queryClient.invalidateQueries()
        if (await getSessionToken()) {
          await prefetchProfileData(queryClient)
        }
      })()
    }
  })
}
