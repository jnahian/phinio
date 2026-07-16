import { createFileRoute } from '@tanstack/react-router'
import { emiCompleteSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { completeEmiImpl } from '#/server/emis.impl'

export function handleCompleteEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiCompleteSchema.parse(
      await readMutationInput(request, { emiId }),
    )
    return completeEmiImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/emis/$emiId/complete')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleCompleteEmi(request, params.emiId),
    },
  },
})
