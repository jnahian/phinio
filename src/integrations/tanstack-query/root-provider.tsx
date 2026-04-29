import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import superjson from 'superjson'
import { registerMutationDefaults } from './mutation-defaults'

const CACHE_KEY = 'phinio-query-cache'
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

    try {
      const persister = createAsyncStoragePersister({
        storage: {
          getItem: async (key) => (await get<string>(key)) ?? null,
          setItem: async (key, value) => {
            await set(key, value)
          },
          removeItem: async (key) => {
            await del(key)
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
