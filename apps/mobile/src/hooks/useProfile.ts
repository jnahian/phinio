import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { SerializedProfile } from '@phinio/trpc'
import { makeTRPC, useTRPC } from '#/lib/trpc'

export type { SerializedProfile }

export function profileQueryOptions(queryClient: QueryClient) {
  return makeTRPC(queryClient).profile.get.queryOptions()
}

export function useProfileQuery() {
  const trpc = useTRPC()
  return useQuery(trpc.profile.get.queryOptions())
}
