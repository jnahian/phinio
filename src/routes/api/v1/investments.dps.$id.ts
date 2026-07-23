import { createFileRoute } from '@tanstack/react-router'
import { dpsUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { updateDpsInvestmentImpl } from '#/server/investments.impl'

export function handleUpdateDps(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = dpsUpdateSchema.parse(
      await readMutationInput(request, { id }),
    )
    return updateDpsInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/dps/$id')({
  server: {
    handlers: {
      PATCH: ({ request, params }) => handleUpdateDps(request, params.id),
    },
  },
})
