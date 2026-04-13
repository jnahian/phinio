import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createEmiFn,
  deleteEmiFn,
  getEmiFn,
  listEmisFn,
  markPaymentPaidFn,
  upcomingPaymentsFn,
} from '#/server/emis'
import type { EmiListFilters } from '#/server/emis'
import type {
  EmiCreateInput,
  MarkPaymentPaidInput,
} from '#/lib/validators'

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

export function useCreateEmi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EmiCreateInput) => createEmiFn({ data: input }),
    onSuccess: () => {
      toast.success('EMI schedule created')
      qc.invalidateQueries({ queryKey: emiKeys.all })
      qc.invalidateQueries({ queryKey: emiKeys.upcoming })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to create EMI')),
  })
}

export function useDeleteEmi() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (emiId: string) => deleteEmiFn({ data: { emiId } }),
    onSuccess: () => {
      toast.success('EMI deleted')
      qc.invalidateQueries({ queryKey: emiKeys.all })
      qc.invalidateQueries({ queryKey: emiKeys.upcoming })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
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

  return useMutation({
    mutationFn: (input: MarkPaymentPaidInput) =>
      markPaymentPaidFn({ data: input }),
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
    },
  })
}
