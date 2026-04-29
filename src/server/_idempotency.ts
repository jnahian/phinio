import superjson from 'superjson'
import { prisma } from '#/db'

/**
 * Type of the first parameter passed to a Prisma `$transaction` callback.
 * Equivalent to Prisma's internal `TransactionClient` type but extracted
 * directly so we don't depend on whether that name is publicly exported in
 * the version of Prisma in use.
 */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Run a mutation idempotently. If `clientMutationId` is provided and the
 * caller's profile has already processed that id, the original result is
 * replayed instead of re-executing `fn`. This makes offline-replay safe:
 * the queued mutation can hit the server multiple times (network retries,
 * stale tab replay, etc.) without duplicating side effects.
 *
 * Implementation runs `fn` inside a transaction so the work and the
 * `processed_mutations` row land atomically — a crash between them would
 * either roll both back (replay re-executes) or roll both forward (replay
 * returns cached result), never half.
 *
 * The result is stored via superjson on the `resultJson` column so `Date`
 * (and `BigInt`, `Map`, etc.) survive replay. Plain `JSON.stringify` would
 * silently degrade Dates to ISO strings — the same client-side bug that
 * superjson resolves on the persisted query cache.
 *
 * Pass `undefined` for `clientMutationId` to opt out (the existing online
 * call path that doesn't generate ids). The mutation still runs in a
 * transaction; only the dedupe step is skipped.
 */
export async function withIdempotency<T>(
  profileId: string,
  clientMutationId: string | undefined,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (clientMutationId) {
      const existing = await tx.processedMutation.findUnique({
        where: {
          profileId_clientMutationId: { profileId, clientMutationId },
        },
        select: { resultJson: true },
      })
      if (existing && existing.resultJson !== null) {
        return superjson.parse<T>(existing.resultJson as string)
      }
    }

    const result = await fn(tx)

    if (clientMutationId) {
      await tx.processedMutation.create({
        data: {
          profileId,
          clientMutationId,
          resultJson: superjson.stringify(result),
        },
      })
    }

    return result
  })
}
