import { createFileRoute } from '@tanstack/react-router'
import { withdrawalSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { withdrawImpl } from '#/server/investments.impl'

export function handleWithdraw(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = withdrawalSchema.parse(
      await readMutationInput(request, { investmentId: id }),
    )
    return withdrawImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/$id/withdraw')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleWithdraw(request, params.id),
    },
  },
})
