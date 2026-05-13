import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createMMKV } from 'react-native-mmkv'
import superjson from 'superjson'
import type { QueryClient } from '@tanstack/react-query'

const MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
// Bump only when the cached query shape changes (renamed keys, structural
// query changes). Patch releases must NOT invalidate cached financial data.
const CACHE_SCHEMA_VERSION = 'v1'
const CACHE_KEY = 'phinio-query-cache'

// Single MMKV instance for the cache namespace. MMKV is a synchronous
// native-backed key/value store — no async/await needed and no IndexedDB
// quirks like the ones the web app guards against.
const storage = createMMKV({ id: 'phinio.query-cache' })

/**
 * Wire the QueryClient up to MMKV-backed persistence. Returns a promise
 * that resolves once the cache has been rehydrated from disk — callers
 * (the root layout) MUST await this before rendering routes that read
 * persisted data, or the first render sees an empty cache.
 */
export function attachPersister(queryClient: QueryClient): Promise<void> {
  const persister = createSyncStoragePersister({
    storage: {
      getItem: (key) => storage.getString(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value)
      },
      removeItem: (key) => {
        storage.remove(key)
      },
    },
    key: CACHE_KEY,
    serialize: superjson.stringify,
    deserialize: superjson.parse,
  })

  const [, restorePromise] = persistQueryClient({
    queryClient,
    persister,
    maxAge: MAX_AGE,
    buster: CACHE_SCHEMA_VERSION,
  })

  // Swallow restore failures so awaiters never reject — a failed restore
  // means we proceed with an empty in-memory cache, which is the same
  // behaviour as a fresh first launch.
  return restorePromise.catch((err) => {
    console.warn('[phinio] mmkv cache restore failed:', err)
  })
}
