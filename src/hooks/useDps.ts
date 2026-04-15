import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createDpsFn,
  deleteDpsFn,
  getDpsFn,
  listDpsFn,
  markDpsInstallmentPaidFn,
  updateDpsFn,
} from '#/server/dps'
import type {
  DpsCreateInput,
  DpsUpdateInput,
  MarkDpsInstallmentPaidInput,
} from '#/lib/validators'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export const dpsKeys = {
  all: ['dps'] as const,
  list: (status: string) => ['dps', 'list', status] as const,
  detail: (id: string) => ['dps', 'detail', id] as const,
}

export function dpsListQueryOptions(status: 'active' | 'completed') {
  return queryOptions({
    queryKey: dpsKeys.list(status),
    queryFn: () => listDpsFn({ data: { status } }),
  })
}

export function useDpsListQuery(status: 'active' | 'completed') {
  return useQuery(dpsListQueryOptions(status))
}

export function useDpsQuery(dpsId: string) {
  return useQuery({
    queryKey: dpsKeys.detail(dpsId),
    queryFn: () => getDpsFn({ data: { dpsId } }),
    enabled: Boolean(dpsId),
  })
}

export function useCreateDps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DpsCreateInput) => createDpsFn({ data: input }),
    onSuccess: () => {
      toast.success('DPS scheme created')
      qc.invalidateQueries({ queryKey: dpsKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Failed to create DPS scheme')),
  })
}

export function useUpdateDps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DpsUpdateInput) => updateDpsFn({ data: input }),
    onSuccess: (_data, input) => {
      toast.success('DPS updated')
      qc.invalidateQueries({ queryKey: dpsKeys.all })
      qc.invalidateQueries({ queryKey: dpsKeys.detail(input.id) })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to update DPS')),
  })
}

export function useDeleteDps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dpsId: string) => deleteDpsFn({ data: { dpsId } }),
    onSuccess: () => {
      toast.success('DPS scheme deleted')
      qc.invalidateQueries({ queryKey: dpsKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Failed to delete')),
  })
}

export function useMarkDpsInstallment(dpsId: string) {
  const qc = useQueryClient()

  type DpsDetailShape = Awaited<ReturnType<typeof getDpsFn>>

  return useMutation({
    mutationFn: (input: MarkDpsInstallmentPaidInput) =>
      markDpsInstallmentPaidFn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: dpsKeys.detail(dpsId) })
      const previous = qc.getQueryData<DpsDetailShape>(dpsKeys.detail(dpsId))

      if (previous) {
        qc.setQueryData<DpsDetailShape>(dpsKeys.detail(dpsId), {
          ...previous,
          installments: previous.installments.map((i) =>
            i.id === input.installmentId
              ? {
                  ...i,
                  status: input.paid ? 'paid' : 'upcoming',
                  paidAt: input.paid ? new Date() : null,
                }
              : i,
          ),
        })
      }

      return { previous }
    },
    onError: (err, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(dpsKeys.detail(dpsId), context.previous)
      }
      toast.error(errorMessage(err, 'Failed to update installment'))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: dpsKeys.detail(dpsId) })
      qc.invalidateQueries({ queryKey: dpsKeys.list('active') })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}
