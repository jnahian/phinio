import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { useMemo } from 'react'
import superjson from 'superjson'
import type { AppRouter } from '@phinio/trpc'
import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Vanilla tRPC client used for module-level needs (mutation registry,
 * prefetch helpers, anything outside React). Browser-only — the SSR
 * pre-render pass shouldn't issue tRPC HTTP requests; route loaders
 * should call server functions or hit Prisma directly.
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
      fetch(url, options) {
        return fetch(url, { ...options, credentials: 'include' })
      },
    }),
  ],
})

/**
 * React-Query options factory tree. Use as `trpc.emis.list.queryOptions(input)`
 * passed to `useQuery`, or `trpc.emis.create.mutationOptions(opts)` passed to
 * `useMutation`. Requires a QueryClient at construction time so the factories
 * can plug into the right cache; we build it lazily per render via the
 * `useTRPC()` hook below.
 */
export function makeTRPC(queryClient: QueryClient) {
  return createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
  })
}

/**
 * React hook returning a tRPC options factory bound to the current
 * QueryClient. Use inside components: `const trpc = useTRPC()`.
 */
export function useTRPC() {
  const queryClient = useQueryClient()
  return useMemo(() => makeTRPC(queryClient), [queryClient])
}
