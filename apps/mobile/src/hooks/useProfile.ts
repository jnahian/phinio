import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { SerializedProfile } from '@phinio/trpc'
import type {
  UpdateProfileCurrencyInput,
  UpdateProfileLanguageInput,
  UpdateProfileNameInput,
} from '@phinio/validators'
import { makeTRPC, useTRPC } from '#/lib/trpc'
import { mutationKeys } from '#/lib/mutation-defaults'
import { notifyError } from '#/lib/notify'
import { useOfflineMutation } from '#/lib/use-offline-mutation'

export type { SerializedProfile }

export function profileQueryOptions(queryClient: QueryClient) {
  return makeTRPC(queryClient).profile.get.queryOptions()
}

export function useProfileQuery() {
  const trpc = useTRPC()
  return useQuery(trpc.profile.get.queryOptions())
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

type ProfileSnapshot = SerializedProfile | undefined

/** Optimistically patch one field of the cached profile. */
function useProfilePatchMutation<TInput extends object>(
  mutationKey: readonly string[],
  patch: (input: TInput, prev: SerializedProfile) => SerializedProfile,
  fallback: string,
) {
  const qc = useQueryClient()
  const trpc = useTRPC()

  return useOfflineMutation<
    unknown,
    Error,
    TInput & { clientMutationId?: string },
    { previous: ProfileSnapshot }
  >({
    mutationKey: [...mutationKey],
    onMutate: async (input) => {
      const profileKey = trpc.profile.get.queryKey()
      await qc.cancelQueries(trpc.profile.pathFilter())
      const previous = qc.getQueryData(profileKey)
      if (previous) {
        qc.setQueryData(profileKey, patch(input, previous))
      }
      return { previous }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(trpc.profile.get.queryKey(), ctx.previous)
      }
      notifyError(err, fallback)
    },
    onSettled: () => {
      void qc.invalidateQueries(trpc.profile.pathFilter())
    },
  })
}

export function useUpdateProfileName() {
  return useProfilePatchMutation<UpdateProfileNameInput>(
    mutationKeys.profileUpdateName,
    (input, prev) => ({ ...prev, fullName: input.fullName }),
    'Failed to update name',
  )
}

export function useUpdateProfileCurrency() {
  return useProfilePatchMutation<UpdateProfileCurrencyInput>(
    mutationKeys.profileUpdateCurrency,
    (input, prev) => ({ ...prev, preferredCurrency: input.preferredCurrency }),
    'Failed to update currency',
  )
}

/**
 * Language switches the live i18n instance immediately and persists the
 * preference to the server. Not in the offline registry (mirrors web —
 * the local switch is the user-visible effect; the server write is
 * best-effort persistence).
 */
export function useUpdateProfileLanguage() {
  const qc = useQueryClient()
  const trpc = useTRPC()
  const { i18n } = useTranslation()

  return useMutation({
    ...trpc.profile.updateLanguage.mutationOptions(),
    onMutate: (input: UpdateProfileLanguageInput) => {
      void i18n.changeLanguage(input.preferredLanguage)
      return undefined
    },
    onError: (err) => notifyError(err, 'Failed to update language'),
    onSettled: () => {
      void qc.invalidateQueries(trpc.profile.pathFilter())
    },
  })
}
