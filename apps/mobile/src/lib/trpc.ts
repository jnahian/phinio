import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { useMemo } from 'react'
import superjson from 'superjson'
import type { AppRouter } from '@phinio/trpc'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { getSessionToken } from './auth'

/**
 * Base URL for the Phinio API. Expo only exposes env vars prefixed with
 * `EXPO_PUBLIC_` to runtime code. Fall back to localhost so the dev
 * client doesn't crash before a real value is wired up.
 */
const BASE_URL =
  process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3000'

/**
 * Vanilla tRPC client for non-React callers (mutation registry,
 * prefetch helpers). Bearer-token auth headers land in Phase 3D.
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${BASE_URL}/api/trpc`,
      transformer: superjson,
      async headers() {
        const token = await getSessionToken()
        const headers: Record<string, string> = { 'x-locale': 'en' }
        if (token) headers.Authorization = `Bearer ${token}`
        return headers
      },
    }),
  ],
})

/**
 * React-Query options factory tree. Use as `trpc.emis.list.queryOptions(input)`
 * passed to `useQuery`, or `trpc.emis.create.mutationOptions(opts)` passed to
 * `useMutation`.
 */
export function makeTRPC(queryClient: QueryClient) {
  return createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
  })
}

/**
 * React hook returning a tRPC options factory bound to the current
 * QueryClient.
 */
export function useTRPC() {
  const queryClient = useQueryClient()
  return useMemo(() => makeTRPC(queryClient), [queryClient])
}
