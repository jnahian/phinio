import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getInvestmentFn, listInvestmentsFn } from '#/server/investments'
import type { InvestmentListFilters } from '#/server/investments'
import type {
  AddDepositInput,
  DpsCloseInput,
  DpsCreateInput,
  DpsUpdateInput,
  InvestmentCreateInput,
  InvestmentUpdateInput,
  MarkDepositPaidInput,
  SavingsCreateInput,
  SavingsUpdateInput,
  WithdrawalInput,
} from '#/lib/validators'
import { mutationKeys } from '#/integrations/tanstack-query/mutation-defaults'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

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
//
// Every hook below uses `mutationKey` only; the `mutationFn` lives in
// `setMutationDefaults` (registerMutationDefaults) so persisted-then-replayed
// mutations on tab reopen can find it. Don't add a `mutationFn` here.
// ---------------------------------------------------------------------------

export function useCreateInvestment() {
  const qc = useQueryClient()
  return useOfflineMutation<{ id: string }, Error, InvestmentCreateInput>({
    mutationKey: mutationKeys.investmentCreate,
    onSuccess: () => {
      toast.success('Investment added')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useUpdateInvestment() {
  const qc = useQueryClient()
  return useOfflineMutation<{ id: string }, Error, InvestmentUpdateInput>({
    mutationKey: mutationKeys.investmentUpdate,
    onSuccess: (data) => {
      toast.success('Investment updated')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: investmentKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useOfflineMutation<unknown, Error, { id: string }>({
    mutationKey: mutationKeys.investmentDelete,
    onSuccess: () => {
      toast.success('Investment deleted')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
  })
}

// ---------------------------------------------------------------------------
// DPS (scheduled) mutations
// ---------------------------------------------------------------------------

export function useCreateDps() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { id: string; name: string },
    Error,
    DpsCreateInput
  >({
    mutationKey: mutationKeys.dpsCreate,
    onSuccess: () => {
      toast.success('DPS scheme added')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useUpdateDps() {
  const qc = useQueryClient()
  return useOfflineMutation<{ id: string }, Error, DpsUpdateInput>({
    mutationKey: mutationKeys.dpsUpdate,
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
  return useOfflineMutation<
    unknown,
    Error,
    MarkDepositPaidInput,
    { prev: unknown }
  >({
    mutationKey: mutationKeys.markDepositPaid,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: investmentKeys.detail(investmentId) })
      const prev = qc.getQueryData(investmentKeys.detail(investmentId))
      qc.setQueryData(
        investmentKeys.detail(investmentId),
        (
          old: { deposits?: Array<{ id: string; status: string }> } | undefined,
        ) => {
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
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useDeleteDps() {
  const qc = useQueryClient()
  return useOfflineMutation<unknown, Error, { id: string }>({
    mutationKey: mutationKeys.investmentDelete,
    onSuccess: () => {
      toast.success('DPS scheme deleted')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
  })
}

// ---------------------------------------------------------------------------
// Savings (flexible) mutations
// ---------------------------------------------------------------------------

export function useCreateSavings() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { id: string; name: string },
    Error,
    SavingsCreateInput
  >({
    mutationKey: mutationKeys.savingsCreate,
    onSuccess: () => {
      toast.success('Savings pot added')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useUpdateSavings() {
  const qc = useQueryClient()
  return useOfflineMutation<{ id: string }, Error, SavingsUpdateInput>({
    mutationKey: mutationKeys.savingsUpdate,
    onSuccess: (data) => {
      toast.success('Savings pot updated')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: investmentKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useAddDeposit(investmentId: string) {
  const qc = useQueryClient()
  return useOfflineMutation<unknown, Error, AddDepositInput>({
    mutationKey: mutationKeys.addDeposit,
    onSuccess: () => {
      toast.success('Deposit added')
      qc.invalidateQueries({ queryKey: investmentKeys.detail(investmentId) })
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to add deposit')),
  })
}

export function useRemoveDeposit(investmentId: string) {
  const qc = useQueryClient()
  return useOfflineMutation<unknown, Error, { depositId: string }>({
    mutationKey: mutationKeys.removeDeposit,
    onSuccess: () => {
      toast.success('Deposit removed')
      qc.invalidateQueries({ queryKey: investmentKeys.detail(investmentId) })
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to remove')),
  })
}

export function useDeleteSavings() {
  const qc = useQueryClient()
  return useOfflineMutation<unknown, Error, { id: string }>({
    mutationKey: mutationKeys.savingsDelete,
    onSuccess: () => {
      toast.success('Savings pot deleted')
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
  })
}

// ---------------------------------------------------------------------------
// Withdrawals (lump_sum + flexible) and DPS premature closure
// ---------------------------------------------------------------------------

export function useWithdraw(investmentId: string) {
  const qc = useQueryClient()
  return useOfflineMutation<{ closed: boolean }, Error, WithdrawalInput>({
    mutationKey: mutationKeys.withdraw,
    onSuccess: (data) => {
      toast.success(data.closed ? 'Investment closed' : 'Withdrawal recorded')
      qc.invalidateQueries({ queryKey: investmentKeys.detail(investmentId) })
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to withdraw')),
  })
}

export function useCloseDps(investmentId: string) {
  const qc = useQueryClient()
  return useOfflineMutation<unknown, Error, DpsCloseInput>({
    mutationKey: mutationKeys.dpsClose,
    onSuccess: () => {
      toast.success('DPS closed')
      qc.invalidateQueries({ queryKey: investmentKeys.detail(investmentId) })
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to close')),
  })
}
