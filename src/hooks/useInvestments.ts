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
  createDpsFn,
  updateDpsFn,
  markDepositPaidFn,
  createSavingsFn,
  updateSavingsFn,
  addDepositFn,
  removeDepositFn,
  deleteSavingsFn,
} from '#/server/investments'
import type { InvestmentListFilters } from '#/server/investments'
import type {
  InvestmentCreateInput,
  InvestmentUpdateInput,
  DpsCreateInput,
  DpsUpdateInput,
  MarkDepositPaidInput,
  SavingsCreateInput,
  SavingsUpdateInput,
  AddDepositInput,
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

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Lump-sum mutations
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// DPS (scheduled) mutations
// ---------------------------------------------------------------------------

export function useCreateDps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DpsCreateInput) => createDpsFn({ data: input }),
    onSuccess: () => {
      toast.success('DPS scheme added')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useUpdateDps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DpsUpdateInput) => updateDpsFn({ data: input }),
    onSuccess: (data) => {
      toast.success('DPS updated')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: investmentKeys.detail(data.id) })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useMarkDepositPaid(investmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkDepositPaidInput) =>
      markDepositPaidFn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: investmentKeys.detail(investmentId) })
      const prev = qc.getQueryData(investmentKeys.detail(investmentId))
      qc.setQueryData(
        investmentKeys.detail(investmentId),
        (old: { deposits?: Array<{ id: string; status: string }> } | undefined) => {
          if (!old) return old
          return {
            ...old,
            deposits: old.deposits?.map((d) =>
              d.id === input.depositId
                ? { ...d, status: input.paid ? 'paid' : 'upcoming' }
                : d,
            ),
          }
        },
      )
      return { prev }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(investmentKeys.detail(investmentId), ctx.prev)
      }
      toast.error('Failed to update')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.detail(investmentId) })
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useDeleteDps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvestmentFn({ data: { id } }),
    onSuccess: () => {
      toast.success('DPS scheme deleted')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
  })
}

// ---------------------------------------------------------------------------
// Savings (flexible) mutations
// ---------------------------------------------------------------------------

export function useCreateSavings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SavingsCreateInput) => createSavingsFn({ data: input }),
    onSuccess: () => {
      toast.success('Savings pot added')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useUpdateSavings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SavingsUpdateInput) => updateSavingsFn({ data: input }),
    onSuccess: (data) => {
      toast.success('Savings pot updated')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: investmentKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useAddDeposit(investmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddDepositInput) => addDepositFn({ data: input }),
    onSuccess: () => {
      toast.success('Deposit added')
      qc.invalidateQueries({ queryKey: investmentKeys.detail(investmentId) })
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to add deposit')),
  })
}

export function useRemoveDeposit(investmentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (depositId: string) =>
      removeDepositFn({ data: { depositId } }),
    onSuccess: () => {
      toast.success('Deposit removed')
      qc.invalidateQueries({ queryKey: investmentKeys.detail(investmentId) })
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to remove')),
  })
}

export function useDeleteSavings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSavingsFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Savings pot deleted')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
  })
}
