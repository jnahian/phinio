import { QueryClient } from '@tanstack/react-query'

/**
 * Factory matching the web QueryClient defaults (see
 * apps/web/src/integrations/tanstack-query/root-provider.tsx) so cache
 * behaviour stays consistent across surfaces. Both apps share a 5-minute
 * staleTime, a 24-hour gcTime, and `offlineFirst` mutations that
 * pause-and-queue rather than fail immediately when offline.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 24 * 60 * 60_000,
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  })
}
