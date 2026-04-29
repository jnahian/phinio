import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import {
  addDepositFn,
  closeDpsFn,
  createDpsFn,
  createInvestmentFn,
  createSavingsFn,
  deleteInvestmentFn,
  deleteSavingsFn,
  markDepositPaidFn,
  removeDepositFn,
  updateDpsFn,
  updateInvestmentFn,
  updateSavingsFn,
  withdrawFn,
} from '#/server/investments'
import { createEmiFn, deleteEmiFn, markPaymentPaidFn } from '#/server/emis'
import {
  markAllNotificationsReadFn,
  markNotificationReadFn,
} from '#/server/notifications'
import { updateProfileCurrencyFn, updateProfileNameFn } from '#/server/profile'
import type {
  AddDepositInput,
  DpsCloseInput,
  DpsCreateInput,
  DpsUpdateInput,
  EmiCreateInput,
  InvestmentCreateInput,
  InvestmentUpdateInput,
  MarkAllNotificationsReadInput,
  MarkDepositPaidInput,
  MarkNotificationReadInput,
  MarkPaymentPaidInput,
  SavingsCreateInput,
  SavingsUpdateInput,
  WithdrawalInput,
  emiIdSchema,
  investmentIdSchema,
  removeDepositSchema,
} from '#/lib/validators'
import type {
  UpdateCurrencyInput,
  UpdateNameInput,
} from '#/server/profile.impl'

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
  emiDelete: ['emis', 'delete'] as const,
  markPaymentPaid: ['payments', 'mark-paid'] as const,
  // Profile
  profileUpdateCurrency: ['profile', 'update-currency'] as const,
  profileUpdateName: ['profile', 'update-name'] as const,
  // Notifications
  markNotificationRead: ['notifications', 'mark-read'] as const,
  markAllNotificationsRead: ['notifications', 'mark-all-read'] as const,
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
      createInvestmentFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.investmentUpdate, {
    ...offlineFirst,
    mutationFn: (input: InvestmentUpdateInput) =>
      updateInvestmentFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.investmentDelete, {
    ...offlineFirst,
    mutationFn: (input: InvestmentIdInput) =>
      deleteInvestmentFn({ data: input }),
  })

  // DPS
  queryClient.setMutationDefaults(mutationKeys.dpsCreate, {
    ...offlineFirst,
    mutationFn: (input: DpsCreateInput) => createDpsFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.dpsUpdate, {
    ...offlineFirst,
    mutationFn: (input: DpsUpdateInput) => updateDpsFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.dpsClose, {
    ...offlineFirst,
    mutationFn: (input: DpsCloseInput) => closeDpsFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.markDepositPaid, {
    ...offlineFirst,
    mutationFn: (input: MarkDepositPaidInput) =>
      markDepositPaidFn({ data: input }),
  })

  // Savings
  queryClient.setMutationDefaults(mutationKeys.savingsCreate, {
    ...offlineFirst,
    mutationFn: (input: SavingsCreateInput) => createSavingsFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.savingsUpdate, {
    ...offlineFirst,
    mutationFn: (input: SavingsUpdateInput) => updateSavingsFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.savingsDelete, {
    ...offlineFirst,
    mutationFn: (input: InvestmentIdInput) => deleteSavingsFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.addDeposit, {
    ...offlineFirst,
    mutationFn: (input: AddDepositInput) => addDepositFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.removeDeposit, {
    ...offlineFirst,
    mutationFn: (input: RemoveDepositInput) => removeDepositFn({ data: input }),
  })

  // Withdrawals
  queryClient.setMutationDefaults(mutationKeys.withdraw, {
    ...offlineFirst,
    mutationFn: (input: WithdrawalInput) => withdrawFn({ data: input }),
  })

  // EMIs
  queryClient.setMutationDefaults(mutationKeys.emiCreate, {
    ...offlineFirst,
    mutationFn: (input: EmiCreateInput) => createEmiFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.emiDelete, {
    ...offlineFirst,
    mutationFn: (input: EmiIdInput) => deleteEmiFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.markPaymentPaid, {
    ...offlineFirst,
    mutationFn: (input: MarkPaymentPaidInput) =>
      markPaymentPaidFn({ data: input }),
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

  // Profile
  queryClient.setMutationDefaults(mutationKeys.profileUpdateCurrency, {
    ...offlineFirst,
    mutationFn: (input: UpdateCurrencyInput) =>
      updateProfileCurrencyFn({ data: input }),
  })
  queryClient.setMutationDefaults(mutationKeys.profileUpdateName, {
    ...offlineFirst,
    mutationFn: (input: UpdateNameInput) =>
      updateProfileNameFn({ data: input }),
  })
}
