import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getInvestmentFn, listInvestmentsFn } from '#/server/investments'
import type {
  InvestmentListFilters,
  InvestmentListItem,
} from '#/server/investments'
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
  return useOfflineMutation<
    { id: string },
    Error,
    InvestmentCreateInput,
    { snapshot: ListSnapshot; id: string }
  >({
    mutationKey: mutationKeys.investmentCreate,
    prepareVariables: (input) => ({ ...input, id: input.id ?? crypto.randomUUID() }),
    onMutate: async (input) => {
      const id = input.id!
      await qc.cancelQueries({ queryKey: investmentKeys.all })
      const row: InvestmentListItem = {
        id,
        name: input.name,
        type: input.type,
        mode: 'lump_sum',
        status: 'active',
        notes: input.notes ?? null,
        createdAt: new Date(),
        investedAmount: input.investedAmount,
        currentValue: input.currentValue,
        exitValue: null,
        totalWithdrawn: '0',
        dateOfInvestment: new Date(input.dateOfInvestment),
        monthlyDeposit: null,
        tenureMonths: null,
        interestRate: null,
        interestType: null,
        startDate: null,
        paidCount: 0,
        maturityValue: null,
        nextDueDate: null,
      }
      const snapshot = applyOptimisticCreate(qc, row)
      return { snapshot, id }
    },
    onError: (err, _input, ctx) => {
      if (ctx) rollbackOptimisticCreate(qc, ctx.snapshot, investmentKeys.detail(ctx.id))
      toast.error(errorMessage(err, 'Failed to save'))
    },
    onSuccess: () => {
      toast.success('Investment added')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

// Server-side LWW response shape — see src/server/_idempotency.ts.
// `stale: true` means the client's expectedUpdatedAt didn't match and the
// edit was skipped; the client should reconcile to the server's row.
type UpdateResult = { id: string; updatedAt?: Date; stale?: boolean }

function handleUpdateResult(
  data: UpdateResult,
  okMessage: string,
  qc: ReturnType<typeof useQueryClient>,
  detailKey: ReadonlyArray<unknown>,
) {
  if (data.stale) {
    toast.warning(
      'Your edit was overwritten by a newer change — refreshing the latest.',
    )
    qc.invalidateQueries({ queryKey: detailKey })
  } else {
    toast.success(okMessage)
  }
}

export function useUpdateInvestment() {
  const qc = useQueryClient()
  return useOfflineMutation<UpdateResult, Error, InvestmentUpdateInput>({
    mutationKey: mutationKeys.investmentUpdate,
    onSuccess: (data) => {
      handleUpdateResult(
        data,
        'Investment updated',
        qc,
        investmentKeys.detail(data.id),
      )
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: investmentKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

/**
 * Shared rollback shape for optimistic delete mutations across investments,
 * DPS, savings, and EMI lists. We snapshot every list-cache entry under the
 * relevant key prefix before filtering AND the matching detail cache, so
 * rollback restores all of them even if multiple list filters were active.
 * Without the detail snapshot, an offline tap on Delete from inside a
 * detail view would clear the row from lists but the detail page would
 * still show stale data until replay finishes (or never, if replay errors).
 */
type DeleteRollbackContext = {
  previousLists: Array<[ReadonlyArray<unknown>, unknown]>
  detailKey: ReadonlyArray<unknown>
  previousDetail: unknown
}

function buildDeleteRollback(
  qc: ReturnType<typeof useQueryClient>,
  listPrefix: ReadonlyArray<string>,
  detailKey: ReadonlyArray<unknown>,
  predicate: (row: { id: string }) => boolean,
): DeleteRollbackContext {
  const entries: Array<[ReadonlyArray<unknown>, unknown]> = qc
    .getQueriesData({ queryKey: listPrefix })
    .map(([key, value]) => [key, value])

  for (const [key, value] of entries) {
    if (!Array.isArray(value)) continue
    qc.setQueryData(key, value.filter(predicate))
  }
  const previousDetail = qc.getQueryData(detailKey)
  qc.removeQueries({ queryKey: detailKey })
  return { previousLists: entries, detailKey, previousDetail }
}

/**
 * Inserts an optimistic row into every list cache whose filter would have
 * matched the new investment server-side. Returns a snapshot the caller
 * can pass to `rollbackOptimisticCreate` on error. Active-only because
 * brand-new rows always start with `status: 'active'` — completed/closed
 * filter views must NOT show them.
 */
type ListSnapshot = Array<[ReadonlyArray<unknown>, unknown]>

function applyOptimisticCreate(
  qc: ReturnType<typeof useQueryClient>,
  row: InvestmentListItem,
): ListSnapshot {
  const previous: ListSnapshot = qc
    .getQueriesData({ queryKey: ['investments', 'list'] })
    .map(([key, value]) => [key, value])
  for (const [key, value] of previous) {
    if (!Array.isArray(value)) continue
    const filter = key[2] as { status?: string; type?: string } | undefined
    if (filter?.status && filter.status !== 'active') continue
    const filterType = filter?.type ?? 'all'
    if (filterType !== 'all' && filterType !== row.type) continue
    qc.setQueryData(key, [row, ...value])
  }
  return previous
}

function rollbackOptimisticCreate(
  qc: ReturnType<typeof useQueryClient>,
  snapshot: ListSnapshot,
  detailKey: ReadonlyArray<unknown>,
) {
  for (const [key, value] of snapshot) {
    qc.setQueryData(key, value)
  }
  qc.removeQueries({ queryKey: detailKey })
}

function rollbackDeletes(
  qc: ReturnType<typeof useQueryClient>,
  ctx: DeleteRollbackContext,
) {
  for (const [key, value] of ctx.previousLists) {
    qc.setQueryData(key, value)
  }
  if (ctx.previousDetail !== undefined) {
    qc.setQueryData(ctx.detailKey, ctx.previousDetail)
  }
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useOfflineMutation<
    unknown,
    Error,
    { id: string },
    DeleteRollbackContext
  >({
    mutationKey: mutationKeys.investmentDelete,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: investmentKeys.all })
      return buildDeleteRollback(
        qc,
        ['investments', 'list'],
        investmentKeys.detail(input.id),
        (r) => r.id !== input.id,
      )
    },
    onError: (err, _input, ctx) => {
      if (ctx) rollbackDeletes(qc, ctx)
      toast.error(errorMessage(err, 'Failed to delete'))
    },
    onSuccess: () => {
      toast.success('Investment deleted')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
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
    DpsCreateInput,
    { snapshot: ListSnapshot; id: string }
  >({
    mutationKey: mutationKeys.dpsCreate,
    prepareVariables: (input) => ({ ...input, id: input.id ?? crypto.randomUUID() }),
    onMutate: async (input) => {
      const id = input.id!
      await qc.cancelQueries({ queryKey: investmentKeys.all })
      const row: InvestmentListItem = {
        id,
        name: input.name,
        type: 'dps',
        mode: 'scheduled',
        status: 'active',
        notes: input.notes ?? null,
        createdAt: new Date(),
        investedAmount: '0',
        currentValue: '0',
        exitValue: null,
        totalWithdrawn: '0',
        dateOfInvestment: null,
        monthlyDeposit: input.monthlyDeposit,
        tenureMonths: input.tenureMonths,
        interestRate: input.interestRate,
        interestType: input.interestType,
        startDate: new Date(input.startDate),
        paidCount: 0,
        maturityValue: null,
        nextDueDate: new Date(input.startDate),
      }
      const snapshot = applyOptimisticCreate(qc, row)
      return { snapshot, id }
    },
    onError: (err, _input, ctx) => {
      if (ctx) rollbackOptimisticCreate(qc, ctx.snapshot, investmentKeys.detail(ctx.id))
      toast.error(errorMessage(err, 'Failed to save'))
    },
    onSuccess: () => {
      toast.success('DPS scheme added')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useUpdateDps() {
  const qc = useQueryClient()
  return useOfflineMutation<UpdateResult, Error, DpsUpdateInput>({
    mutationKey: mutationKeys.dpsUpdate,
    onSuccess: (data) => {
      handleUpdateResult(
        data,
        'DPS updated',
        qc,
        investmentKeys.detail(data.id),
      )
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
  return useOfflineMutation<
    unknown,
    Error,
    { id: string },
    DeleteRollbackContext
  >({
    mutationKey: mutationKeys.investmentDelete,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: investmentKeys.all })
      return buildDeleteRollback(
        qc,
        ['investments', 'list'],
        investmentKeys.detail(input.id),
        (r) => r.id !== input.id,
      )
    },
    onError: (err, _input, ctx) => {
      if (ctx) rollbackDeletes(qc, ctx)
      toast.error(errorMessage(err, 'Failed to delete'))
    },
    onSuccess: () => {
      toast.success('DPS scheme deleted')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
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
    SavingsCreateInput,
    { snapshot: ListSnapshot; id: string }
  >({
    mutationKey: mutationKeys.savingsCreate,
    prepareVariables: (input) => ({ ...input, id: input.id ?? crypto.randomUUID() }),
    onMutate: async (input) => {
      const id = input.id!
      await qc.cancelQueries({ queryKey: investmentKeys.all })
      const initial = Number(input.currentValue)
      const row: InvestmentListItem = {
        id,
        name: input.name,
        type: 'savings',
        mode: 'flexible',
        status: 'active',
        notes: input.notes ?? null,
        createdAt: new Date(),
        investedAmount: initial > 0 ? input.currentValue : '0',
        currentValue: input.currentValue,
        exitValue: null,
        totalWithdrawn: '0',
        dateOfInvestment: null,
        monthlyDeposit: null,
        tenureMonths: null,
        interestRate: null,
        interestType: null,
        startDate: new Date(input.startDate),
        paidCount: 0,
        maturityValue: null,
        nextDueDate: null,
      }
      const snapshot = applyOptimisticCreate(qc, row)
      return { snapshot, id }
    },
    onError: (err, _input, ctx) => {
      if (ctx) rollbackOptimisticCreate(qc, ctx.snapshot, investmentKeys.detail(ctx.id))
      toast.error(errorMessage(err, 'Failed to save'))
    },
    onSuccess: () => {
      toast.success('Savings pot added')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useUpdateSavings() {
  const qc = useQueryClient()
  return useOfflineMutation<UpdateResult, Error, SavingsUpdateInput>({
    mutationKey: mutationKeys.savingsUpdate,
    onSuccess: (data) => {
      handleUpdateResult(
        data,
        'Savings pot updated',
        qc,
        investmentKeys.detail(data.id),
      )
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
  return useOfflineMutation<
    unknown,
    Error,
    { id: string },
    DeleteRollbackContext
  >({
    mutationKey: mutationKeys.savingsDelete,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: investmentKeys.all })
      return buildDeleteRollback(
        qc,
        ['investments', 'list'],
        investmentKeys.detail(input.id),
        (r) => r.id !== input.id,
      )
    },
    onError: (err, _input, ctx) => {
      if (ctx) rollbackDeletes(qc, ctx)
      toast.error(errorMessage(err, 'Failed to delete'))
    },
    onSuccess: () => {
      toast.success('Savings pot deleted')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
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
