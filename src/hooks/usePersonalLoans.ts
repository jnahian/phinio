import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getPersonalLoanFn, listPersonalLoansFn } from '#/server/personal-loans'
import type { PersonalLoanListFilters } from '#/server/personal-loans'
import type {
  AddLoanRepaymentInput,
  PersonalLoanCreateInput,
  PersonalLoanUpdateInput,
} from '#/lib/validators'
import { mutationKeys } from '#/integrations/tanstack-query/mutation-defaults'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export const loanKeys = {
  all: ['personal-loans'] as const,
  list: (filters: PersonalLoanListFilters) =>
    ['personal-loans', 'list', filters] as const,
  detail: (id: string) => ['personal-loans', 'detail', id] as const,
}

type LoanDetail = Awaited<ReturnType<typeof getPersonalLoanFn>>
type LoanList = Awaited<ReturnType<typeof listPersonalLoansFn>>

export function personalLoansListQueryOptions(
  filters: PersonalLoanListFilters,
) {
  return queryOptions({
    queryKey: loanKeys.list(filters),
    queryFn: () => listPersonalLoansFn({ data: filters }),
  })
}

export function personalLoanQueryOptions(loanId: string) {
  return queryOptions({
    queryKey: loanKeys.detail(loanId),
    queryFn: () => getPersonalLoanFn({ data: { loanId } }),
  })
}

export function usePersonalLoansQuery(filters: PersonalLoanListFilters) {
  return useQuery(personalLoansListQueryOptions(filters))
}

export function usePersonalLoanQuery(loanId: string) {
  return useQuery({
    ...personalLoanQueryOptions(loanId),
    enabled: Boolean(loanId),
  })
}

function invalidateAfterLoanChange(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: loanKeys.all })
  qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  qc.invalidateQueries({ queryKey: ['activity'] })
}

/**
 * Create a loan optimistically with a client-minted id, so the detail screen
 * the form navigates to renders even while the request is queued offline.
 */
export function useCreatePersonalLoan() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { id: string },
    Error,
    PersonalLoanCreateInput,
    {
      loanId: string
      previousLists: Array<[ReadonlyArray<unknown>, LoanList | undefined]>
    }
  >({
    mutationKey: mutationKeys.loanCreate,
    prepareVariables: (input) => ({
      ...input,
      id: input.id ?? crypto.randomUUID(),
    }),
    onMutate: async (input) => {
      const loanId = input.id!
      await qc.cancelQueries({ queryKey: loanKeys.all })
      const previousLists: Array<
        [ReadonlyArray<unknown>, LoanList | undefined]
      > = qc
        .getQueriesData<LoanList>({ queryKey: ['personal-loans', 'list'] })
        .map(([key, value]) => [key, value])

      // Mirror the server's normalization: a total equal to the principal is
      // stored as null.
      const totalRepayable =
        input.totalRepayable !== undefined &&
        Number(input.totalRepayable) !== Number(input.principal)
          ? input.totalRepayable
          : null
      const totalDue = totalRepayable ?? input.principal
      const now = new Date()
      const row: LoanList[number] = {
        id: loanId,
        direction: input.direction,
        counterparty: input.counterparty,
        principal: input.principal,
        totalRepayable,
        totalDue,
        repaid: '0.00',
        outstanding: totalDue,
        startDate: new Date(input.startDate),
        status: 'active',
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      }
      qc.setQueryData<LoanDetail>(loanKeys.detail(loanId), {
        ...row,
        repayments: [],
      })
      for (const [key, value] of previousLists) {
        if (!Array.isArray(value)) continue
        const filter = key[2] as PersonalLoanListFilters | undefined
        if ((filter?.status ?? 'active') !== 'active') continue
        qc.setQueryData(key, [row, ...value])
      }
      return { loanId, previousLists }
    },
    onError: (err, _input, ctx) => {
      if (ctx) {
        for (const [key, value] of ctx.previousLists) {
          qc.setQueryData(key, value)
        }
        qc.removeQueries({ queryKey: loanKeys.detail(ctx.loanId) })
      }
      toast.error(errorMessage(err, 'Failed to add loan'))
    },
    onSuccess: () => {
      toast.success('Loan added')
    },
    onSettled: () => invalidateAfterLoanChange(qc),
  })
}

type LoanUpdateResult = { id: string; updatedAt?: Date; stale?: boolean }

export function useUpdatePersonalLoan() {
  const qc = useQueryClient()
  return useOfflineMutation<LoanUpdateResult, Error, PersonalLoanUpdateInput>({
    mutationKey: mutationKeys.loanUpdate,
    onSuccess: (data) => {
      if (data.stale) {
        toast.error('Saved elsewhere — refresh to see latest')
      } else {
        toast.success('Loan updated')
      }
      invalidateAfterLoanChange(qc)
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useDeletePersonalLoan() {
  const qc = useQueryClient()
  return useOfflineMutation<
    unknown,
    Error,
    { loanId: string },
    {
      previousLists: Array<[ReadonlyArray<unknown>, unknown]>
      previousDetail: unknown
    }
  >({
    mutationKey: mutationKeys.loanDelete,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: loanKeys.all })
      const previousLists: Array<[ReadonlyArray<unknown>, unknown]> = qc
        .getQueriesData({ queryKey: ['personal-loans', 'list'] })
        .map(([key, value]) => [key, value])
      const previousDetail = qc.getQueryData(loanKeys.detail(input.loanId))
      for (const [key, value] of previousLists) {
        if (!Array.isArray(value)) continue
        qc.setQueryData(
          key,
          value.filter((row: { id: string }) => row.id !== input.loanId),
        )
      }
      qc.removeQueries({ queryKey: loanKeys.detail(input.loanId) })
      return { previousLists, previousDetail }
    },
    onError: (err, input, ctx) => {
      if (ctx) {
        for (const [key, value] of ctx.previousLists) {
          qc.setQueryData(key, value)
        }
        if (ctx.previousDetail) {
          qc.setQueryData(loanKeys.detail(input.loanId), ctx.previousDetail)
        }
      }
      toast.error(errorMessage(err, 'Failed to delete'))
    },
    onSuccess: () => {
      toast.success('Loan deleted')
    },
    onSettled: () => invalidateAfterLoanChange(qc),
  })
}

export function useAddLoanRepayment() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { id: string; loanId: string; settled: boolean },
    Error,
    AddLoanRepaymentInput
  >({
    mutationKey: mutationKeys.loanAddRepayment,
    onSuccess: (data) => {
      toast.success(data.settled ? 'Loan settled' : 'Payment logged')
      invalidateAfterLoanChange(qc)
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to log payment')),
  })
}

export function useRemoveLoanRepayment() {
  const qc = useQueryClient()
  return useOfflineMutation<
    { id: string; loanId: string; reopened: boolean },
    Error,
    { repaymentId: string }
  >({
    mutationKey: mutationKeys.loanRemoveRepayment,
    onSuccess: () => {
      toast.success('Payment removed')
      invalidateAfterLoanChange(qc)
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to remove')),
  })
}
