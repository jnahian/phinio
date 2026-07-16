import { createFileRoute } from '@tanstack/react-router'
import { dpsCloseSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { closeDpsImpl } from '#/server/investments.impl'

export function handleCloseDps(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = dpsCloseSchema.parse(
      await readMutationInput(request, { investmentId: id }),
    )
    return closeDpsImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/dps/$id/close')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleCloseDps(request, params.id),
    },
  },
})
