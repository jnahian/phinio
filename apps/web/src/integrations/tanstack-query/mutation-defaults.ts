import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { trpcClient } from '#/lib/trpc'
import {
  clearReadNotificationsFn,
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from '#/server/notifications'
import type {
  AddDepositInput,
  DpsCloseInput,
  DpsCreateInput,
  DpsUpdateInput,
  EmiCompleteInput,
  EmiCreateInput,
  EmiUpdateInput,
  InvestmentCreateInput,
  InvestmentUpdateInput,
  ClearReadNotificationsInput,
  MarkAllNotificationsReadInput,
  MarkDepositPaidInput,
  MarkNotificationReadInput,
  MarkPaymentPaidInput,
  SavingsCreateInput,
  SavingsUpdateInput,
  UpdateProfileCurrencyInput,
  UpdateProfileNameInput,
  WithdrawalInput,
  emiIdSchema,
  investmentIdSchema,
  removeDepositSchema,
} from '@phinio/validators'

type InvestmentIdInput = z.infer<typeof investmentIdSchema>
type EmiIdInput = z.infer<typeof emiIdSchema>
type RemoveDepositInput = z.infer<typeof removeDepositSchema>

/**
 * Mutation keys are exported so hooks reference the same string array that
 * `setMutationDefaults` registered. A typo in the hook would silently lose
 * the registered `mutationFn` — paused mutations would never replay after a
 * reload because `resumePausedMutations()` couldn't find a function to call.
 */
export const mutationKeys = {
  // Investments — lump_sum
  investmentCreate: ['investments', 'create'] as const,
  investmentUpdate: ['investments', 'update'] as const,
  investmentDelete: ['investments', 'delete'] as const,
  // DPS (scheduled)
  dpsCreate: ['dps', 'create'] as const,
  dpsUpdate: ['dps', 'update'] as const,
  dpsClose: ['dps', 'close'] as const,
  markDepositPaid: ['deposits', 'mark-paid'] as const,
  // Savings (flexible)
  savingsCreate: ['savings', 'create'] as const,
  savingsUpdate: ['savings', 'update'] as const,
  savingsDelete: ['savings', 'delete'] as const,
  addDeposit: ['deposits', 'add'] as const,
  removeDeposit: ['deposits', 'remove'] as const,
  // Withdrawals
  withdraw: ['withdrawals', 'create'] as const,
  // EMIs
  emiCreate: ['emis', 'create'] as const,
  emiUpdate: ['emis', 'update'] as const,
  emiComplete: ['emis', 'complete'] as const,
  emiDelete: ['emis', 'delete'] as const,
  markPaymentPaid: ['payments', 'mark-paid'] as const,
  // Profile
  profileUpdateCurrency: ['profile', 'update-currency'] as const,
  profileUpdateName: ['profile', 'update-name'] as const,
  // Notifications
  markNotificationRead: ['notifications', 'mark-read'] as const,
  markAllNotificationsRead: ['notifications', 'mark-all-read'] as const,
  clearReadNotifications: ['notifications', 'clear-read'] as const,
} satisfies Record<string, ReadonlyArray<string>>

/**
 * Register a `mutationFn` against every mutation key the app uses, with
 * `networkMode: 'offlineFirst'` so taps while offline pause-and-queue rather
 * than rejecting immediately. This MUST run before `persistQueryClient`
 * finishes restoring; otherwise rehydrated mutations have no `mutationFn`
 * to call and `resumePausedMutations()` silently does nothing.
 *
 * Hooks elsewhere reference these keys via `useMutation({ mutationKey })`
 * and rely on the registered defaults for the actual server call. Without
 * this layer, a paused mutation would lose its closure on tab close and
 * never replay.
 */
export function registerMutationDefaults(queryClient: QueryClient) {
  const offlineFirst = { networkMode: 'offlineFirst' as const }

  // Investments
  queryClient.setMutationDefaults(mutationKeys.investmentCreate, {
    ...offlineFirst,
    mutationFn: (input: InvestmentCreateInput) =>
      trpcClient.investments.create.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.investmentUpdate, {
    ...offlineFirst,
    mutationFn: (input: InvestmentUpdateInput) =>
      trpcClient.investments.update.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.investmentDelete, {
    ...offlineFirst,
    mutationFn: (input: InvestmentIdInput) =>
      trpcClient.investments.delete.mutate(input),
  })

  // DPS
  queryClient.setMutationDefaults(mutationKeys.dpsCreate, {
    ...offlineFirst,
    mutationFn: (input: DpsCreateInput) =>
      trpcClient.investments.createDps.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.dpsUpdate, {
    ...offlineFirst,
    mutationFn: (input: DpsUpdateInput) =>
      trpcClient.investments.updateDps.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.dpsClose, {
    ...offlineFirst,
    mutationFn: (input: DpsCloseInput) =>
      trpcClient.investments.closeDps.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.markDepositPaid, {
    ...offlineFirst,
    mutationFn: (input: MarkDepositPaidInput) =>
      trpcClient.investments.markDepositPaid.mutate(input),
  })

  // Savings
  queryClient.setMutationDefaults(mutationKeys.savingsCreate, {
    ...offlineFirst,
    mutationFn: (input: SavingsCreateInput) =>
      trpcClient.investments.createSavings.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.savingsUpdate, {
    ...offlineFirst,
    mutationFn: (input: SavingsUpdateInput) =>
      trpcClient.investments.updateSavings.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.savingsDelete, {
    ...offlineFirst,
    mutationFn: (input: InvestmentIdInput) =>
      trpcClient.investments.deleteSavings.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.addDeposit, {
    ...offlineFirst,
    mutationFn: (input: AddDepositInput) =>
      trpcClient.investments.addDeposit.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.removeDeposit, {
    ...offlineFirst,
    mutationFn: (input: RemoveDepositInput) =>
      trpcClient.investments.removeDeposit.mutate(input),
  })

  // Withdrawals
  queryClient.setMutationDefaults(mutationKeys.withdraw, {
    ...offlineFirst,
    mutationFn: (input: WithdrawalInput) =>
      trpcClient.investments.withdraw.mutate(input),
  })

  // EMIs
  queryClient.setMutationDefaults(mutationKeys.emiCreate, {
    ...offlineFirst,
    mutationFn: (input: EmiCreateInput) => trpcClient.emis.create.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.emiUpdate, {
    ...offlineFirst,
    mutationFn: (input: EmiUpdateInput) => trpcClient.emis.update.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.emiComplete, {
    ...offlineFirst,
    mutationFn: (input: EmiCompleteInput) =>
      trpcClient.emis.complete.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.emiDelete, {
    ...offlineFirst,
    mutationFn: (input: EmiIdInput) => trpcClient.emis.delete.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.markPaymentPaid, {
    ...offlineFirst,
    mutationFn: (input: MarkPaymentPaidInput) =>
      trpcClient.emis.markPaymentPaid.mutate(input),
  })

  // Notifications
  queryClient.setMutationDefaults(mutationKeys.markNotificationRead, {
    ...offlineFirst,
    mutationFn: (input: MarkNotificationReadInput) =>
      markNotificationReadFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.markAllNotificationsRead, {
    ...offlineFirst,
    mutationFn: (input: MarkAllNotificationsReadInput) =>
      markAllNotificationsReadFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.clearReadNotifications, {
    ...offlineFirst,
    mutationFn: (input: ClearReadNotificationsInput) =>
      clearReadNotificationsFn({ data: input }),
  })

  // Profile
  queryClient.setMutationDefaults(mutationKeys.profileUpdateCurrency, {
    ...offlineFirst,
    mutationFn: (input: UpdateProfileCurrencyInput) =>
      trpcClient.profile.updateCurrency.mutate(input),
  })
  queryClient.setMutationDefaults(mutationKeys.profileUpdateName, {
    ...offlineFirst,
    mutationFn: (input: UpdateProfileNameInput) =>
      trpcClient.profile.updateName.mutate(input),
  })
}
