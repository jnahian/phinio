import { createFileRoute } from '@tanstack/react-router'
import { savingsCreateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { createSavingsInvestmentImpl } from '#/server/investments.impl'

export function handleCreateSavings(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = savingsCreateSchema.parse(await readMutationInput(request))
    return createSavingsInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/savings')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateSavings(request),
    },
  },
})
