import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { inferProcedureOutput } from '@trpc/server'
import type { AppRouter, InvestmentListItem } from '@phinio/trpc'
import type { z } from 'zod'
import type {
  AddDepositInput,
  DpsCloseInput,
  DpsCreateInput,
  DpsUpdateInput,
  InvestmentCreateInput,
  InvestmentUpdateInput,
  MarkDepositPaidInput,
  RemoveDepositInput,
  SavingsCreateInput,
  SavingsUpdateInput,
  WithdrawalInput,
  investmentListQuerySchema,
} from '@phinio/validators'
import { makeTRPC, useTRPC } from '#/lib/trpc'
import { mutationKeys } from '#/lib/mutation-defaults'
import { notifyError } from '#/lib/notify'
import { randomUUID } from '#/lib/uuid'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

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

// ---------------------------------------------------------------------------
// Mutations — adapted from apps/web/src/hooks/useInvestments.ts. Cache ops
// use the tRPC proxy key helpers. Optimistic policy: creates prepend a list
// row to matching filter caches; deletes filter rows out; deposit mark-paid
// flips in the detail cache; everything else settles via invalidation.
// ---------------------------------------------------------------------------

type InvestmentDetailShape = inferProcedureOutput<
  AppRouter['investments']['get']
>
type InvestmentListShape = inferProcedureOutput<
  AppRouter['investments']['list']
>
type ListSnapshots = [readonly unknown[], InvestmentListShape | undefined][]

/** Status bucket the list router uses: 'active' vs everything else. */
function listIncludes(
  key: readonly unknown[],
  row: { status: string; type: string },
): boolean {
  const meta = key[1] as { input?: { type?: string; status?: string } }
  const filterType = meta?.input?.type ?? 'all'
  const filterStatus = meta?.input?.status ?? 'active'
  const activeBucket = row.status === 'active'
  if ((filterStatus === 'active') !== activeBucket) return false
  if (filterType === 'all') return true
  return filterType === row.type
}

function useInvestmentInvalidations() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  return () => {
    void qc.invalidateQueries(trpc.investments.pathFilter())
    void qc.invalidateQueries(trpc.dashboard.stats.queryFilter())
    void qc.invalidateQueries(trpc.activity.pathFilter())
  }
}

function useOptimisticListInsert() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  return {
    snapshot: (): ListSnapshots =>
      qc
        .getQueriesData<InvestmentListShape>(trpc.investments.list.queryFilter())
        .map(([key, value]) => [key, value]),
    insert: (snapshots: ListSnapshots, row: InvestmentListShape[number]) => {
      for (const [key, value] of snapshots) {
        if (!Array.isArray(value)) continue
        if (!listIncludes(key, row)) continue
        qc.setQueryData(key as never, [row, ...value] as never)
      }
    },
    rollback: (snapshots: ListSnapshots) => {
      for (const [key, value] of snapshots) {
        qc.setQueryData(key as never, value as never)
      }
    },
  }
}

function baseListRow(
  overrides: Partial<InvestmentListShape[number]> &
    Pick<InvestmentListShape[number], 'id' | 'name' | 'type' | 'mode'>,
): InvestmentListShape[number] {
  return {
    status: 'active',
    notes: null,
    createdAt: new Date(),
    investedAmount: '0.00',
    currentValue: '0.00',
    exitValue: null,
    totalWithdrawn: '0.00',
    dateOfInvestment: null,
    estimatedClosureDate: null,
    monthlyDeposit: null,
    tenureMonths: null,
    interestRate: null,
    interestType: null,
    startDate: null,
    paidCount: 0,
    maturityValue: null,
    nextDueDate: null,
    ...overrides,
  }
}

export function useCreateInvestment() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const lists = useOptimisticListInsert()
  const invalidate = useInvestmentInvalidations()

  return useOfflineMutation<
    { id: string },
    Error,
    InvestmentCreateInput,
    { snapshots: ListSnapshots }
  >({
    mutationKey: mutationKeys.investmentCreate,
    prepareVariables: (input) => ({ ...input, id: input.id ?? randomUUID() }),
    onMutate: async (input) => {
      await qc.cancelQueries(trpc.investments.pathFilter())
      const snapshots = lists.snapshot()
      lists.insert(
        snapshots,
        baseListRow({
          id: input.id!,
          name: input.name,
          type: input.type,
          mode: 'lump_sum',
          notes: input.notes ?? null,
          investedAmount: input.investedAmount,
          currentValue: input.currentValue,
          dateOfInvestment: new Date(input.dateOfInvestment),
          estimatedClosureDate: input.estimatedClosureDate
            ? new Date(input.estimatedClosureDate)
            : null,
        }),
      )
      return { snapshots }
    },
    onError: (err, _input, ctx) => {
      if (ctx) lists.rollback(ctx.snapshots)
      notifyError(err, 'Failed to create investment')
    },
    onSettled: invalidate,
  })
}

export function useCreateDps() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const lists = useOptimisticListInsert()
  const invalidate = useInvestmentInvalidations()

  return useOfflineMutation<
    { id: string },
    Error,
    DpsCreateInput,
    { snapshots: ListSnapshots }
  >({
    mutationKey: mutationKeys.dpsCreate,
    prepareVariables: (input) => ({ ...input, id: input.id ?? randomUUID() }),
    onMutate: async (input) => {
      await qc.cancelQueries(trpc.investments.pathFilter())
      const snapshots = lists.snapshot()
      lists.insert(
        snapshots,
        baseListRow({
          id: input.id!,
          name: input.name,
          type: 'dps',
          mode: 'scheduled',
          notes: input.notes ?? null,
          monthlyDeposit: input.monthlyDeposit,
          tenureMonths: input.tenureMonths,
          interestRate: input.interestRate,
          interestType: input.interestType,
          startDate: new Date(input.startDate),
          nextDueDate: new Date(input.startDate),
        }),
      )
      return { snapshots }
    },
    onError: (err, _input, ctx) => {
      if (ctx) lists.rollback(ctx.snapshots)
      notifyError(err, 'Failed to create DPS')
    },
    onSettled: invalidate,
  })
}

export function useCreateSavings() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const lists = useOptimisticListInsert()
  const invalidate = useInvestmentInvalidations()

  return useOfflineMutation<
    { id: string },
    Error,
    SavingsCreateInput,
    { snapshots: ListSnapshots }
  >({
    mutationKey: mutationKeys.savingsCreate,
    prepareVariables: (input) => ({ ...input, id: input.id ?? randomUUID() }),
    onMutate: async (input) => {
      await qc.cancelQueries(trpc.investments.pathFilter())
      const snapshots = lists.snapshot()
      lists.insert(
        snapshots,
        baseListRow({
          id: input.id!,
          name: input.name,
          type: 'savings',
          mode: 'flexible',
          notes: input.notes ?? null,
          currentValue: input.currentValue,
          startDate: new Date(input.startDate),
        }),
      )
      return { snapshots }
    },
    onError: (err, _input, ctx) => {
      if (ctx) lists.rollback(ctx.snapshots)
      notifyError(err, 'Failed to create savings')
    },
    onSettled: invalidate,
  })
}

type UpdateResult = { id: string; updatedAt?: Date; stale?: boolean }

function useSimpleInvestmentMutation<TInput extends object>(
  mutationKey: readonly string[],
  fallback: string,
) {
  const invalidate = useInvestmentInvalidations()
  return useOfflineMutation<unknown, Error, TInput & { clientMutationId?: string }>({
    mutationKey: [...mutationKey],
    onSuccess: (data) => {
      const result = data as UpdateResult | undefined
      if (result && typeof result === 'object' && 'stale' in result && result.stale) {
        notifyError(new Error('Saved elsewhere — refresh to see latest'), fallback)
      }
    },
    onError: (err) => notifyError(err, fallback),
    onSettled: invalidate,
  })
}

export function useUpdateInvestment() {
  return useSimpleInvestmentMutation<InvestmentUpdateInput>(
    mutationKeys.investmentUpdate,
    'Failed to save',
  )
}

export function useUpdateDps() {
  return useSimpleInvestmentMutation<DpsUpdateInput>(
    mutationKeys.dpsUpdate,
    'Failed to save',
  )
}

export function useUpdateSavings() {
  return useSimpleInvestmentMutation<SavingsUpdateInput>(
    mutationKeys.savingsUpdate,
    'Failed to save',
  )
}

export function useWithdraw() {
  return useSimpleInvestmentMutation<WithdrawalInput>(
    mutationKeys.withdraw,
    'Failed to withdraw',
  )
}

export function useAddDeposit() {
  return useSimpleInvestmentMutation<AddDepositInput>(
    mutationKeys.addDeposit,
    'Failed to add deposit',
  )
}

export function useRemoveDeposit() {
  return useSimpleInvestmentMutation<RemoveDepositInput>(
    mutationKeys.removeDeposit,
    'Failed to remove deposit',
  )
}

export function useCloseDps() {
  return useSimpleInvestmentMutation<DpsCloseInput>(
    mutationKeys.dpsClose,
    'Failed to close DPS',
  )
}

function useDeleteInvestmentMutation(
  mutationKey: readonly string[],
  fallback: string,
) {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const invalidate = useInvestmentInvalidations()

  return useOfflineMutation<
    unknown,
    Error,
    { id: string; clientMutationId?: string },
    { snapshots: ListSnapshots; detail: InvestmentDetailShape | undefined }
  >({
    mutationKey: [...mutationKey],
    onMutate: async (input) => {
      await qc.cancelQueries(trpc.investments.pathFilter())
      const snapshots: ListSnapshots = qc
        .getQueriesData<InvestmentListShape>(trpc.investments.list.queryFilter())
        .map(([key, value]) => [key, value])
      const detailKey = trpc.investments.get.queryKey({ id: input.id })
      const detail = qc.getQueryData<InvestmentDetailShape>(detailKey)
      for (const [key, value] of snapshots) {
        if (!Array.isArray(value)) continue
        qc.setQueryData(
          key as never,
          value.filter((row) => row.id !== input.id) as never,
        )
      }
      qc.removeQueries({ queryKey: detailKey })
      return { snapshots, detail }
    },
    onError: (err, input, ctx) => {
      if (ctx) {
        for (const [key, value] of ctx.snapshots) {
          qc.setQueryData(key as never, value as never)
        }
        if (ctx.detail) {
          qc.setQueryData(
            trpc.investments.get.queryKey({ id: input.id }),
            ctx.detail,
          )
        }
      }
      notifyError(err, fallback)
    },
    onSettled: invalidate,
  })
}

export function useDeleteInvestment() {
  return useDeleteInvestmentMutation(
    mutationKeys.investmentDelete,
    'Failed to delete',
  )
}

export function useDeleteSavings() {
  return useDeleteInvestmentMutation(
    mutationKeys.savingsDelete,
    'Failed to delete',
  )
}

/** Flip a DPS deposit's paid state optimistically in the detail cache. */
export function useMarkDepositPaid(investmentId: string) {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const invalidate = useInvestmentInvalidations()

  return useOfflineMutation<
    unknown,
    Error,
    MarkDepositPaidInput,
    { previous: InvestmentDetailShape | undefined }
  >({
    mutationKey: mutationKeys.markDepositPaid,
    onMutate: async (input) => {
      const detailKey = trpc.investments.get.queryKey({ id: investmentId })
      await qc.cancelQueries({ queryKey: detailKey })
      const previous = qc.getQueryData<InvestmentDetailShape>(detailKey)
      if (previous) {
        qc.setQueryData(detailKey, {
          ...previous,
          deposits: previous.deposits.map((d) =>
            d.id === input.depositId
              ? {
                  ...d,
                  status: input.paid ? 'paid' : 'upcoming',
                  paidAt: input.paid ? new Date() : null,
                }
              : d,
          ),
        })
      }
      return { previous }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(
          trpc.investments.get.queryKey({ id: investmentId }),
          ctx.previous,
        )
      }
      notifyError(err, 'Failed to update deposit')
    },
    onSettled: invalidate,
  })
}
