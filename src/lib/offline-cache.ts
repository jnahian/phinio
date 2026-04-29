import type { QueryClient } from '@tanstack/react-query'
import { del } from 'idb-keyval'

// Must match the `key` passed to createAsyncStoragePersister in
// src/integrations/tanstack-query/root-provider.tsx. Exported there isn't
// trivial without circular imports, so it lives here as a single source.
export const CACHE_KEY = 'phinio-query-cache'

/**
 * Wipe the in-memory QueryClient and the persisted IndexedDB cache.
 * Call this on sign-out so the next user (or the same user signing in
 * with different credentials) doesn't see the previous user's cached
 * financial data — and so any paused offline mutations don't replay
 * into the next account.
 *
 * Failures from `idb-keyval.del` are swallowed: the in-memory clear
 * already happened, and an unwritable IndexedDB (Safari Private Browsing,
 * full disk) means there was no persisted blob to leak in the first place.
 */
export async function clearOfflineCache(queryClient: QueryClient) {
  queryClient.getMutationCache().clear()
  queryClient.clear()
  try {
    await del(CACHE_KEY)
  } catch {
    // No persisted blob to remove, or storage unavailable. Either way
    // the in-memory state is already cleared.
  }
}
