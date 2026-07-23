import { createFileRoute } from '@tanstack/react-router'
import {
  investmentCreateSchema,
  investmentListQuerySchema,
} from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import {
  createInvestmentImpl,
  getInvestmentImpl,
  listInvestmentsImpl,
} from '#/server/investments.impl'

export function handleListInvestments(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const url = new URL(request.url)
    const query = investmentListQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
    })
    return listInvestmentsImpl(profileId, query)
  })
}

export function handleCreateInvestment(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = investmentCreateSchema.parse(await readMutationInput(request))
    // createInvestmentImpl returns only { id }; the API returns the full record
    const { id } = await createInvestmentImpl(profileId, input)
    return getInvestmentImpl(profileId, id)
  })
}

export const Route = createFileRoute('/api/v1/investments/')({
  server: {
    handlers: {
      GET: ({ request }) => handleListInvestments(request),
      POST: ({ request }) => handleCreateInvestment(request),
    },
  },
})
