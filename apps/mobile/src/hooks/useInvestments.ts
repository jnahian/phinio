import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import type { investmentListQuerySchema } from '@phinio/validators'
import type { InvestmentListItem } from '@phinio/trpc'
import { makeTRPC, useTRPC } from '#/lib/trpc'

export type InvestmentListFilters = z.infer<typeof investmentListQuerySchema>
export type { InvestmentListItem }

export function investmentsListQueryOptions(
  queryClient: QueryClient,
  filters: InvestmentListFilters,
) {
  return makeTRPC(queryClient).investments.list.queryOptions(filters)
}

export function useInvestmentsQuery(filters: InvestmentListFilters) {
  const trpc = useTRPC()
  return useQuery(trpc.investments.list.queryOptions(filters))
}

export function useInvestmentQuery(id: string) {
  const trpc = useTRPC()
  return useQuery({
    ...trpc.investments.get.queryOptions({ id }),
    enabled: Boolean(id),
  })
}
