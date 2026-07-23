import { createFileRoute } from '@tanstack/react-router'
import { investmentIdSchema, savingsUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  deleteInvestmentImpl,
  updateSavingsInvestmentImpl,
} from '#/server/investments.impl'

export function handleUpdateSavings(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = savingsUpdateSchema.parse(
      await readMutationInput(request, { id }),
    )
    return updateSavingsInvestmentImpl(profileId, input)
  })
}

export function handleDeleteSavings(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentIdSchema.parse(
      await readMutationInput(request, { id }),
    )
    // Same impl the web's deleteSavingsFn delegates to.
    return deleteInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/savings/$id')({
  server: {
    handlers: {
      PATCH: ({ request, params }) => handleUpdateSavings(request, params.id),
      DELETE: ({ request, params }) => handleDeleteSavings(request, params.id),
    },
  },
})
