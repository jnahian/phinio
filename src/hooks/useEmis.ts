import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getEmiFn, listEmisFn, upcomingPaymentsFn } from '#/server/emis'
import type { EmiListFilters } from '#/server/emis'
import type {
  EmiCreateInput,
  EmiUpdateInput,
  MarkPaymentPaidInput,
} from '#/lib/validators'
import { calculateEmi, generateAmortization } from '#/lib/emi-calculator'
import { mutationKeys } from '#/integrations/tanstack-query/mutation-defaults'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export const emiKeys = {
  all: ['emis'] as const,
  list: (filters: EmiListFilters) => ['emis', 'list', filters] as const,
  detail: (id: string) => ['emis', 'detail', id] as const,
  upcoming: ['upcoming-payments'] as const,
}

export function emisListQueryOptions(filters: EmiListFilters) {
  return queryOptions({
    queryKey: emiKeys.list(filters),
    queryFn: () => listEmisFn({ data: filters }),
  })
}

export function useEmisQuery(filters: EmiListFilters) {
  return useQuery(emisListQueryOptions(filters))
}

export function useEmiQuery(emiId: string) {
  return useQuery({
    queryKey: emiKeys.detail(emiId),
    queryFn: () => getEmiFn({ data: { emiId } }),
    enabled: Boolean(emiId),
  })
}

export function useUpcomingPaymentsQuery() {
  return useQuery({
    queryKey: emiKeys.upcoming,
    queryFn: () => upcomingPaymentsFn(),
  })
}

/**
 * Create an EMI optimistically, including the full payment schedule. The
 * amortization function in `#/lib/emi-calculator` is isomorphic — it uses
 * pure JS, no Prisma, no Node-only APIs — so the client can compute the
 * same schedule the server will compute on replay. Both ends use the same
 * client-supplied UUIDs for the EMI and every payment row, so the cache
 * and the eventual server insert agree on row identity. Without that
 * agreement, a "mark paid" tap on an optimistic payment would 404 if it
 * lands on the server before this create's idempotency entry, or
 * targeted a stale UUID after invalidation.
 */
export function useCreateEmi() {
  const qc = useQueryClient()
  type EmiDetailShape = Awaited<ReturnType<typeof getEmiFn>>
  type ListShape = Awaited<ReturnType<typeof listEmisFn>>

  return useOfflineMutation<
    { id: string; label: string; type: string; emiAmount: string },
    Error,
    EmiCreateInput,
    {
      emiId: string
      previousLists: Array<[ReadonlyArray<unknown>, ListShape | undefined]>
    }
  >({
    mutationKey: mutationKeys.emiCreate,
    prepareVariables: (input) => ({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      paymentIds:
        input.paymentIds ??
        Array.from({ length: input.tenureMonths }, () => crypto.randomUUID()),
    }),
    onMutate: async (input) => {
      const emiId = input.id!
      const paymentIds = input.paymentIds!

      // Compute the schedule the same way the server will. emi-calculator
      // is pure JS, so this matches byte-for-byte on replay. The server
      // exposes `remainingBalance` as the next-unpaid payment's stored
      // remaining-balance (principal payoff after that installment), so we
      // use `schedule[0].remainingBalance` for the optimistic value.
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

      await qc.cancelQueries({ queryKey: emiKeys.all })

      // Snapshot every list cache entry so onError can roll all of them
      // back. The list query key includes filters, so there can be more
      // than one entry depending on which list pages the user has opened.
      const previousLists: Array<
        [ReadonlyArray<unknown>, ListShape | undefined]
      > = qc
        .getQueriesData<ListShape>({ queryKey: ['emis', 'list'] })
        .map(([key, value]) => [key, value])

      // Optimistic detail: full EMI + full payment list.
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
        startDate: new Date(input.startDate),
        status: 'active',
        createdAt: new Date(),
        payments: schedule.map((row, i) => ({
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
      }
      qc.setQueryData<EmiDetailShape>(emiKeys.detail(emiId), detail)

      // Optimistic list rows: prepend the new EMI to caches whose filter
      // would actually include it. List query keys are
      // `['emis', 'list', { type: 'bank_loan' | 'credit_card' | 'all' }]`.
      // The new row belongs in `'all'` and in lists matching its own type;
      // filtered views for the other type must NOT show it temporarily.
      const listRow = {
        id: emiId,
        label: input.label,
        type: input.type,
        principal: input.principal,
        interestRate: input.interestRate,
        tenureMonths: input.tenureMonths,
        emiAmount,
        startDate: new Date(input.startDate),
        status: 'active',
        createdAt: new Date(),
        totalPayments: schedule.length,
        paidCount: 0,
        nextDueDate: schedule[0]?.dueDate ?? null,
        // Match server: next-unpaid payment's stored remainingBalance.
        // For a fresh EMI, that's the first installment's remainingBalance.
        remainingBalance: schedule[0]?.remainingBalance ?? '0.00',
      }
      for (const [key, value] of previousLists) {
        if (!Array.isArray(value)) continue
        const filter = key[2] as { type?: string } | undefined
        const filterType = filter?.type ?? 'all'
        if (filterType !== 'all' && filterType !== input.type) continue
        qc.setQueryData(key, [listRow, ...value])
      }

      return { emiId, previousLists }
    },
    onError: (err, _input, ctx) => {
      if (ctx) {
        for (const [key, value] of ctx.previousLists) {
          qc.setQueryData(key, value)
        }
        qc.removeQueries({ queryKey: emiKeys.detail(ctx.emiId) })
      }
      toast.error(errorMessage(err, 'Failed to create EMI'))
    },
    onSuccess: () => {
      toast.success('EMI schedule created')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: emiKeys.all })
      qc.invalidateQueries({ queryKey: emiKeys.upcoming })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

type EmiUpdateResult = { id: string; updatedAt?: Date; stale?: boolean }

export function useUpdateEmi() {
  const qc = useQueryClient()
  return useOfflineMutation<EmiUpdateResult, Error, EmiUpdateInput>({
    mutationKey: mutationKeys.emiUpdate,
    onSuccess: (data) => {
      if (data.stale) {
        toast.error('Saved elsewhere — refresh to see latest')
      } else {
        toast.success('EMI updated')
      }
      qc.invalidateQueries({ queryKey: emiKeys.all })
      qc.invalidateQueries({ queryKey: emiKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to save')),
  })
}

export function useDeleteEmi() {
  const qc = useQueryClient()
  return useOfflineMutation<
    unknown,
    Error,
    { emiId: string },
    {
      previousLists: Array<[ReadonlyArray<unknown>, unknown]>
      previousDetail: unknown
    }
  >({
    mutationKey: mutationKeys.emiDelete,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: emiKeys.all })
      const previousLists: Array<[ReadonlyArray<unknown>, unknown]> = qc
        .getQueriesData({ queryKey: ['emis', 'list'] })
        .map(([key, value]) => [key, value])
      const previousDetail = qc.getQueryData(emiKeys.detail(input.emiId))

      // Filter the row out of every cached list page.
      for (const [key, value] of previousLists) {
        if (!Array.isArray(value)) continue
        qc.setQueryData(
          key,
          value.filter((row: { id: string }) => row.id !== input.emiId),
        )
      }
      qc.removeQueries({ queryKey: emiKeys.detail(input.emiId) })
      return { previousLists, previousDetail }
    },
    onError: (err, input, ctx) => {
      if (ctx) {
        for (const [key, value] of ctx.previousLists) {
          qc.setQueryData(key, value)
        }
        if (ctx.previousDetail) {
          qc.setQueryData(emiKeys.detail(input.emiId), ctx.previousDetail)
        }
      }
      toast.error(errorMessage(err, 'Failed to delete'))
    },
    onSuccess: () => {
      toast.success('EMI deleted')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: emiKeys.all })
      qc.invalidateQueries({ queryKey: emiKeys.upcoming })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

/**
 * Mark a payment row as paid or upcoming. Uses TanStack Query's optimistic
 * update pattern so the checkbox flips instantly and rolls back on error.
 * The detail cache is the source of truth — we update the nested payments
 * array in place.
 */
export function useMarkPayment(emiId: string) {
  const qc = useQueryClient()

  type EmiDetailShape = Awaited<ReturnType<typeof getEmiFn>>

  return useOfflineMutation<
    unknown,
    Error,
    MarkPaymentPaidInput,
    { previous: EmiDetailShape | undefined }
  >({
    mutationKey: mutationKeys.markPaymentPaid,
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: emiKeys.detail(emiId) })
      const previous = qc.getQueryData<EmiDetailShape>(emiKeys.detail(emiId))

      if (previous) {
        qc.setQueryData<EmiDetailShape>(emiKeys.detail(emiId), {
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
        qc.setQueryData(emiKeys.detail(emiId), context.previous)
      }
      toast.error(errorMessage(err, 'Failed to update payment'))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: emiKeys.detail(emiId) })
      qc.invalidateQueries({ queryKey: emiKeys.upcoming })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}
