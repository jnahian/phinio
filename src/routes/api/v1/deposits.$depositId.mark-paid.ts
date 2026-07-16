import { createFileRoute } from '@tanstack/react-router'
import { markDepositPaidSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { markDepositPaidImpl } from '#/server/investments.impl'

export function handleMarkDepositPaid(
  request: Request,
  depositId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markDepositPaidSchema.parse(
      await readMutationInput(request, { depositId }),
    )
    return markDepositPaidImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/deposits/$depositId/mark-paid')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleMarkDepositPaid(request, params.depositId),
    },
  },
})
