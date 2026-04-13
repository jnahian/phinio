import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createInvestmentFn,
  deleteInvestmentFn,
  getInvestmentFn,
  listInvestmentsFn,
  updateInvestmentFn,
} from '#/server/investments'
import type { InvestmentListFilters } from '#/server/investments'
import type {
  InvestmentCreateInput,
  InvestmentUpdateInput,
} from '#/lib/validators'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export const investmentKeys = {
  all: ['investments'] as const,
  list: (filters: InvestmentListFilters) =>
    ['investments', 'list', filters] as const,
  detail: (id: string) => ['investments', 'detail', id] as const,
}

export function investmentsListQueryOptions(filters: InvestmentListFilters) {
  return queryOptions({
    queryKey: investmentKeys.list(filters),
    queryFn: () => listInvestmentsFn({ data: filters }),
  })
}

export function useInvestmentsQuery(filters: InvestmentListFilters) {
  return useQuery(investmentsListQueryOptions(filters))
}

export function useInvestmentQuery(id: string) {
  return useQuery({
    queryKey: investmentKeys.detail(id),
    queryFn: () => getInvestmentFn({ data: { id } }),
    enabled: Boolean(id),
  })
}

export function useCreateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvestmentCreateInput) =>
      createInvestmentFn({ data: input }),
    onSuccess: () => {
      toast.success('Investment added')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useUpdateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvestmentUpdateInput) =>
      updateInvestmentFn({ data: input }),
    onSuccess: (data) => {
      toast.success('Investment updated')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: investmentKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvestmentFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Investment deleted')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
  })
}
