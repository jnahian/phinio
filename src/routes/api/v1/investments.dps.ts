import { createFileRoute } from '@tanstack/react-router'
import { dpsCreateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { createDpsInvestmentImpl } from '#/server/investments.impl'

export function handleCreateDps(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = dpsCreateSchema.parse(await readMutationInput(request))
    return createDpsInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/dps')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateDps(request),
    },
  },
})
