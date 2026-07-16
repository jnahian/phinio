import { createFileRoute } from '@tanstack/react-router'
import { removeDepositSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { removeDepositImpl } from '#/server/investments.impl'

export function handleRemoveDeposit(
  request: Request,
  depositId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = removeDepositSchema.parse(
      await readMutationInput(request, { depositId }),
    )
    return removeDepositImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/deposits/$depositId')({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        handleRemoveDeposit(request, params.depositId),
    },
  },
})
