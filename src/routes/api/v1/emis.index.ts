import { createFileRoute } from '@tanstack/react-router'
import { emiCreateSchema, emiListQuerySchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { createEmiImpl, getEmiImpl, listEmisImpl } from '#/server/emis.impl'

export function handleListEmis(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const url = new URL(request.url)
    const query = emiListQuerySchema.parse({
      type: url.searchParams.get('type') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    })
    return listEmisImpl(profileId, query)
  })
}

export function handleCreateEmi(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiCreateSchema.parse(await readMutationInput(request))
    // createEmiImpl returns a summary ({ id, label, ... }) — re-read so the
    // REST response is the full serialized resource, money as strings.
    const created = await createEmiImpl(profileId, input)
    return getEmiImpl(profileId, created.id)
  })
}

export const Route = createFileRoute('/api/v1/emis/')({
  server: {
    handlers: {
      GET: ({ request }) => handleListEmis(request),
      POST: ({ request }) => handleCreateEmi(request),
    },
  },
})
