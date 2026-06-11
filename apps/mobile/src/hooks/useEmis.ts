import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { inferProcedureOutput } from '@trpc/server'
import type { AppRouter } from '@phinio/trpc'
import type { z } from 'zod'
import type {
  EmiCompleteInput,
  EmiCreateInput,
  EmiUpdateInput,
  MarkPaymentPaidInput,
  emiListQuerySchema,
} from '@phinio/validators'
import {
  FEE_PAYMENT_NUMBER,
  calculateEmi,
  generateAmortization,
} from '@phinio/calc'
import { makeTRPC, useTRPC } from '#/lib/trpc'
import { mutationKeys } from '#/lib/mutation-defaults'
import { notifyError } from '#/lib/notify'
import { randomUUID } from '#/lib/uuid'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

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

// ---------------------------------------------------------------------------
// Mutations — adapted from apps/web/src/hooks/useEmis.ts with cache ops
// keyed via the tRPC proxy helpers (queryKey / queryFilter / pathFilter)
// so optimistic patches hit the entries the queries actually read.
// ---------------------------------------------------------------------------

type EmiDetailShape = inferProcedureOutput<AppRouter['emis']['get']>
type EmiListShape = inferProcedureOutput<AppRouter['emis']['list']>

/**
 * Create an EMI optimistically, including the full payment schedule.
 * `@phinio/calc` is isomorphic, so the client computes the same schedule
 * the server will compute on replay, and both ends use the same
 * client-supplied UUIDs for the EMI and every payment row — the cache
 * and the eventual server insert agree on row identity.
 */
export function useCreateEmi() {
  const qc = useQueryClient()
  const trpc = useTRPC()

  return useOfflineMutation<
    {
      id: string
      label: string
      type: string
      emiAmount: string
      processingFee: string | null
    },
    Error,
    EmiCreateInput,
    {
      emiId: string
      previousLists: [readonly unknown[], EmiListShape | undefined][]
    }
  >({
    mutationKey: mutationKeys.emiCreate,
    prepareVariables: (input) => ({
      ...input,
      id: input.id ?? randomUUID(),
      paymentIds:
        input.paymentIds ??
        Array.from({ length: input.tenureMonths }, () => randomUUID()),
      // Pre-allocate an id for the fee row only when one will actually be
      // inserted, so the optimistic cache and the server agree on identity
      // on replay.
      processingFeeId:
        input.processingFee && Number(input.processingFee) > 0
          ? (input.processingFeeId ?? randomUUID())
          : undefined,
    }),
    onMutate: async (input) => {
      const emiId = input.id!
      const paymentIds = input.paymentIds!
      const feeAmount =
        input.processingFee && Number(input.processingFee) > 0
          ? input.processingFee
          : null
      const feeId = feeAmount ? input.processingFeeId! : null

      const { emiAmount } = calculateEmi({
        principal: input.principal,
        annualRate: input.interestRate,
        tenureMonths: input.tenureMonths,
        type: input.type,
      })
      const schedule = generateAmortization({
        principal: input.principal,
        annualRate: input.interestRate,
        tenureMonths: input.tenureMonths,
        startDate: new Date(input.startDate),
        type: input.type,
      })

      await qc.cancelQueries(trpc.emis.pathFilter())

      const previousLists: [readonly unknown[], EmiListShape | undefined][] =
        qc
          .getQueriesData<EmiListShape>(trpc.emis.list.queryFilter())
          .map(([key, value]) => [key, value])

      const now = new Date()
      const startDateObj = new Date(input.startDate)
      const detail: EmiDetailShape = {
        id: emiId,
        profileId: '',
        label: input.label,
        type: input.type,
        notes: input.notes ?? null,
        principal: input.principal,
        interestRate: input.interestRate,
        tenureMonths: input.tenureMonths,
        emiAmount,
        processingFee: feeAmount,
        startDate: startDateObj,
        status: 'active',
        createdAt: now,
        payments: [
          ...(feeAmount && feeId
            ? [
                {
                  id: feeId,
                  emiId,
                  profileId: '',
                  paymentNumber: FEE_PAYMENT_NUMBER,
                  dueDate: startDateObj,
                  emiAmount: feeAmount,
                  principalComponent: '0',
                  interestComponent: '0',
                  remainingBalance: input.principal,
                  status: 'paid',
                  paidAt: now,
                },
              ]
            : []),
          ...schedule.map((row, i) => ({
            id: paymentIds[i],
            emiId,
            profileId: '',
            paymentNumber: row.paymentNumber,
            dueDate: row.dueDate,
            emiAmount: row.emiAmount,
            principalComponent: row.principalComponent,
            interestComponent: row.interestComponent,
            remainingBalance: row.remainingBalance,
            status: 'upcoming',
            paidAt: null,
          })),
        ],
      }
      qc.setQueryData(trpc.emis.get.queryKey({ emiId }), detail)

      // Prepend the new EMI only to list caches whose filter would
      // actually include it. The tRPC list key carries the input at
      // key[1].input.
      const listRow: EmiListShape[number] = {
        id: emiId,
        label: input.label,
        type: input.type,
        principal: input.principal,
        interestRate: input.interestRate,
        tenureMonths: input.tenureMonths,
        emiAmount,
        startDate: startDateObj,
        status: 'active',
        createdAt: now,
        totalPayments: schedule.length,
        paidCount: 0,
        nextDueDate: schedule[0]?.dueDate ?? null,
        remainingBalance: schedule[0]?.remainingBalance ?? '0.00',
      }
      for (const [key, value] of previousLists) {
        if (!Array.isArray(value)) continue
        const meta = key[1] as { input?: { type?: string; status?: string } }
        const filterType = meta?.input?.type ?? 'all'
        const filterStatus = meta?.input?.status ?? 'active'
        if (filterStatus !== 'active') continue
        if (filterType !== 'all' && filterType !== input.type) continue
        qc.setQueryData(key as never, [listRow, ...value] as never)
      }

      return { emiId, previousLists }
    },
    onError: (err, _input, ctx) => {
      if (ctx) {
        for (const [key, value] of ctx.previousLists) {
          qc.setQueryData(key as never, value as never)
        }
        qc.removeQueries({
          queryKey: trpc.emis.get.queryKey({ emiId: ctx.emiId }),
        })
      }
      notifyError(err, 'Failed to create EMI')
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.emis.pathFilter())
      void qc.invalidateQueries(trpc.dashboard.stats.queryFilter())
      void qc.invalidateQueries(trpc.activity.pathFilter())
    },
  })
}

type EmiUpdateResult = { id: string; updatedAt?: Date; stale?: boolean }

export function useUpdateEmi() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  return useOfflineMutation<EmiUpdateResult, Error, EmiUpdateInput>({
    mutationKey: mutationKeys.emiUpdate,
    onSuccess: (data) => {
      if (data.stale) {
        notifyError(
          new Error('Saved elsewhere — refresh to see latest'),
          'Not saved',
        )
      }
      void qc.invalidateQueries(trpc.emis.pathFilter())
      void qc.invalidateQueries(trpc.dashboard.stats.queryFilter())
      void qc.invalidateQueries(trpc.activity.pathFilter())
    },
    onError: (err) => notifyError(err, 'Failed to save'),
  })
}

export function useDeleteEmi() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  return useOfflineMutation<
    unknown,
    Error,
    { emiId: string },
    {
      previousLists: [readonly unknown[], EmiListShape | undefined][]
      previousDetail: EmiDetailShape | undefined
    }
  >({
    mutationKey: mutationKeys.emiDelete,
    onMutate: async (input) => {
      await qc.cancelQueries(trpc.emis.pathFilter())
      const previousLists: [readonly unknown[], EmiListShape | undefined][] =
        qc
          .getQueriesData<EmiListShape>(trpc.emis.list.queryFilter())
          .map(([key, value]) => [key, value])
      const detailKey = trpc.emis.get.queryKey({ emiId: input.emiId })
      const previousDetail = qc.getQueryData<EmiDetailShape>(detailKey)

      for (const [key, value] of previousLists) {
        if (!Array.isArray(value)) continue
        qc.setQueryData(
          key as never,
          value.filter((row) => row.id !== input.emiId) as never,
        )
      }
      qc.removeQueries({ queryKey: detailKey })
      return { previousLists, previousDetail }
    },
    onError: (err, input, ctx) => {
      if (ctx) {
        for (const [key, value] of ctx.previousLists) {
          qc.setQueryData(key as never, value as never)
        }
        if (ctx.previousDetail) {
          qc.setQueryData(
            trpc.emis.get.queryKey({ emiId: input.emiId }),
            ctx.previousDetail,
          )
        }
      }
      notifyError(err, 'Failed to delete')
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.emis.pathFilter())
      void qc.invalidateQueries(trpc.dashboard.stats.queryFilter())
      void qc.invalidateQueries(trpc.activity.pathFilter())
    },
  })
}

/**
 * Mark a payment row as paid or upcoming — flips instantly in the detail
 * cache, rolls back on error.
 */
export function useMarkPayment(emiId: string) {
  const qc = useQueryClient()
  const trpc = useTRPC()
  type MarkResult = { id: string; paid: boolean; autoCompleted?: boolean }

  return useOfflineMutation<
    MarkResult,
    Error,
    MarkPaymentPaidInput,
    { previous: EmiDetailShape | undefined }
  >({
    mutationKey: mutationKeys.markPaymentPaid,
    onMutate: async (input) => {
      const detailKey = trpc.emis.get.queryKey({ emiId })
      await qc.cancelQueries({ queryKey: detailKey })
      const previous = qc.getQueryData<EmiDetailShape>(detailKey)

      if (previous) {
        qc.setQueryData(detailKey, {
          ...previous,
          payments: previous.payments.map((p) =>
            p.id === input.paymentId
              ? {
                  ...p,
                  status: input.paid ? 'paid' : 'upcoming',
                  paidAt: input.paid ? new Date() : null,
                }
              : p,
          ),
        })
      }
      return { previous }
    },
    onError: (err, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(trpc.emis.get.queryKey({ emiId }), context.previous)
      }
      notifyError(err, 'Failed to update payment')
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.emis.pathFilter())
      void qc.invalidateQueries(trpc.dashboard.stats.queryFilter())
      void qc.invalidateQueries(trpc.activity.pathFilter())
    },
  })
}

/**
 * Mark an EMI as completed: flips status and marks any still-unpaid
 * regular installments paid (early payoff close-out).
 */
export function useCompleteEmi() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  type CompleteResult = { id: string; alreadyCompleted: boolean }

  return useOfflineMutation<
    CompleteResult,
    Error,
    EmiCompleteInput,
    { previous: EmiDetailShape | undefined }
  >({
    mutationKey: mutationKeys.emiComplete,
    onMutate: async (input) => {
      const detailKey = trpc.emis.get.queryKey({ emiId: input.emiId })
      await qc.cancelQueries({ queryKey: detailKey })
      const previous = qc.getQueryData<EmiDetailShape>(detailKey)
      if (previous) {
        const now = new Date()
        qc.setQueryData(detailKey, {
          ...previous,
          status: 'completed',
          payments: previous.payments.map((p) =>
            p.status === 'paid'
              ? p
              : { ...p, status: 'paid', paidAt: p.paidAt ?? now },
          ),
        })
      }
      return { previous }
    },
    onError: (err, input, context) => {
      if (context?.previous) {
        qc.setQueryData(
          trpc.emis.get.queryKey({ emiId: input.emiId }),
          context.previous,
        )
      }
      notifyError(err, 'Failed to complete EMI')
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.emis.pathFilter())
      void qc.invalidateQueries(trpc.dashboard.stats.queryFilter())
      void qc.invalidateQueries(trpc.activity.pathFilter())
    },
  })
}
