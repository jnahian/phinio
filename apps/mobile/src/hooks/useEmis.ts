import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import type { emiListQuerySchema } from '@phinio/validators'
import { makeTRPC, useTRPC } from '#/lib/trpc'

export type EmiListFilters = z.infer<typeof emiListQuerySchema>

export function emisListQueryOptions(
  queryClient: QueryClient,
  filters: EmiListFilters,
) {
  return makeTRPC(queryClient).emis.list.queryOptions(filters)
}

export function useEmisQuery(filters: EmiListFilters) {
  const trpc = useTRPC()
  return useQuery(trpc.emis.list.queryOptions(filters))
}

export function useEmiQuery(emiId: string) {
  const trpc = useTRPC()
  return useQuery({
    ...trpc.emis.get.queryOptions({ emiId }),
    enabled: Boolean(emiId),
  })
}

export function useUpcomingPaymentsQuery() {
  const trpc = useTRPC()
  return useQuery(trpc.emis.upcomingPayments.queryOptions())
}
