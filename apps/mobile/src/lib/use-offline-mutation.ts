import { useMutation } from '@tanstack/react-query'
import type {
  MutateOptions,
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query'
import { useCallback } from 'react'
import { randomUUID } from './uuid'

/**
 * Variables passed to an offline-aware mutation. The hook injects
 * `clientMutationId` automatically; callers don't need to provide it.
 * Procedures accept it as optional, so omitting it on a stale call site
 * is safe — but the queue's idempotency safety relies on it being present.
 */
export type OfflineMutationVariables = object & { clientMutationId?: string }

/**
 * Drop-in replacement for `useMutation` that mirrors the web app's
 * offline contract (apps/web/src/lib/use-offline-mutation.ts):
 * 1. Generates a single `clientMutationId` (uuid v4) per logical mutation
 *    and injects it into the variables BEFORE TanStack Query stores them.
 *    Retries and replays use the same id, so the server's
 *    `processed_mutations` table can dedupe.
 * 2. Optionally runs `prepareVariables` to inject other ids the offline
 *    flow needs (e.g. client-minted `id` for an optimistic create, or a
 *    pre-generated array of child-row ids for an EMI schedule). Runs
 *    once per logical mutation in the same spot as the
 *    `clientMutationId` injection — never inside `mutationFn`.
 * 3. Honours the `mutationKey`-only contract — the actual `mutationFn`
 *    must already be registered via `queryClient.setMutationDefaults` so
 *    rehydrated mutations after a force-close can find it.
 *
 * IMPORTANT: do NOT generate UUIDs inside `mutationFn` — that runs once
 * per attempt, not once per logical mutation, and the server would see
 * a different id on each retry. We inject them here, where TanStack Query
 * persists the variables verbatim.
 */
export function useOfflineMutation<
  TData,
  TError,
  TVariables extends OfflineMutationVariables,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    prepareVariables?: (input: TVariables) => TVariables
  },
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { prepareVariables, ...mutationOptions } = options
  const result = useMutation<TData, TError, TVariables, TContext>(
    mutationOptions,
  )

  const wrap = useCallback(
    (variables: TVariables): TVariables => {
      const withId: TVariables = {
        ...variables,
        clientMutationId: variables.clientMutationId ?? randomUUID(),
      }
      return prepareVariables ? prepareVariables(withId) : withId
    },
    [prepareVariables],
  )

  const mutate = useCallback(
    (
      variables: TVariables,
      mutateOptions?: MutateOptions<TData, TError, TVariables, TContext>,
    ) => {
      result.mutate(wrap(variables), mutateOptions)
    },
    [result, wrap],
  )

  const mutateAsync = useCallback(
    (
      variables: TVariables,
      mutateOptions?: MutateOptions<TData, TError, TVariables, TContext>,
    ) => result.mutateAsync(wrap(variables), mutateOptions),
    [result, wrap],
  )

  return {
    ...result,
    mutate,
    mutateAsync,
  }
}
