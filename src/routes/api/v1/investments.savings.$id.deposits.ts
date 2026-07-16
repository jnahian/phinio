import { createFileRoute } from '@tanstack/react-router'
import { addDepositSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { addDepositImpl } from '#/server/investments.impl'

export function handleAddDeposit(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = addDepositSchema.parse(
      await readMutationInput(request, { investmentId: id }),
    )
    return addDepositImpl(profileId, input)
  })
}

export const Route = createFileRoute(
  '/api/v1/investments/savings/$id/deposits',
)({
  server: {
    handlers: {
      POST: ({ request, params }) => handleAddDeposit(request, params.id),
    },
  },
})
