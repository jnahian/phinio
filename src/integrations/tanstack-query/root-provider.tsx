import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import superjson from 'superjson'
import { CACHE_KEY } from '#/lib/offline-cache'
import { registerMutationDefaults } from '#/integrations/tanstack-query/mutation-defaults'

const MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
// Bump only when the cached query shape changes (renamed keys, structural
// query changes). Patch releases must NOT invalidate cached financial data.
const CACHE_SCHEMA_VERSION = 'v1'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        // Long enough that cache entries survive between sessions and the
        // persister gets a chance to write them. The persister's maxAge
        // governs the actual offline retention window.
        gcTime: 24 * 60 * 60_000,
      },
      mutations: {
        // Pause-and-queue offline mutations rather than failing them
        // immediately. The reconnect handler in __root.tsx calls
        // resumePausedMutations() once the network is back.
        networkMode: 'offlineFirst',
      },
    },
  })

  if (typeof window !== 'undefined') {
    // Register the mutationFn for every offline-replayable mutation key.
    // This MUST happen before persistQueryClient finishes restoring;
    // otherwise rehydrated mutations have no function to call and
    // resumePausedMutations() silently does nothing.
    registerMutationDefaults(queryClient)

    // Async IDB failures (quota exceeded, Safari Private Browsing
    // throwing on first write, full disk) happen at runtime inside the
    // storage callbacks — the outer try/catch only catches setup-time
    // throws. We guard each callback so a runtime failure logs once and
    // silently falls back to in-memory cache rather than spamming the
    // console on every cache write.
    let persistenceWarned = false
    const warnOnce = (op: string, err: unknown) => {
      if (persistenceWarned) return
      persistenceWarned = true
      console.warn(`[phinio] offline cache ${op} failed; using memory:`, err)
    }
    try {
      const persister = createAsyncStoragePersister({
        storage: {
          getItem: async (key) => {
            try {
              return (await get<string>(key)) ?? null
            } catch (err) {
              warnOnce('read', err)
              return null
            }
          },
          setItem: async (key, value) => {
            try {
              await set(key, value)
            } catch (err) {
              warnOnce('write', err)
            }
          },
          removeItem: async (key) => {
            try {
              await del(key)
            } catch {
              // No-op — caller is removing; failure means there's
              // nothing to remove or storage is unavailable.
            }
          },
        },
        key: CACHE_KEY,
        // superjson preserves Date, BigInt, Map, etc. — JSON would silently
        // turn Date into ISO strings and break callsites that expect Date.
        serialize: superjson.stringify,
        deserialize: superjson.parse,
      })

      persistQueryClient({
        queryClient,
        persister,
        maxAge: MAX_AGE,
        buster: CACHE_SCHEMA_VERSION,
      })
    } catch (err) {
      console.warn(
        '[phinio] offline cache unavailable, falling back to memory:',
        err,
      )
    }
  }

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
