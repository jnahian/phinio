import { createFileRoute } from '@tanstack/react-router'
import { investmentIdSchema, investmentUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  deleteInvestmentImpl,
  getInvestmentImpl,
  updateInvestmentImpl,
} from '#/server/investments.impl'

export function handleGetInvestment(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return getInvestmentImpl(profileId, id)
  })
}

export function handleUpdateInvestment(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentUpdateSchema.parse(
      await readMutationInput(request, { id }),
    )
    return updateInvestmentImpl(profileId, input)
  })
}

export function handleDeleteInvestment(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentIdSchema.parse(
      await readMutationInput(request, { id }),
    )
    return deleteInvestmentImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/investments/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetInvestment(request, params.id),
      PATCH: ({ request, params }) =>
        handleUpdateInvestment(request, params.id),
      DELETE: ({ request, params }) =>
        handleDeleteInvestment(request, params.id),
    },
  },
})
