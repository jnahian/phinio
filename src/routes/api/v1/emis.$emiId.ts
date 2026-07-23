import { createFileRoute } from '@tanstack/react-router'
import { emiIdSchema, emiUpdateSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { deleteEmiImpl, getEmiImpl, updateEmiImpl } from '#/server/emis.impl'

export function handleGetEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return getEmiImpl(profileId, emiId)
  })
}

export function handleUpdateEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiUpdateSchema.parse(
      await readMutationInput(request, { emiId }),
    )
    // updateEmiImpl returns { id, updatedAt, stale } — re-read so the REST
    // response is the full serialized resource.
    const result = await updateEmiImpl(profileId, input)
    return { ...(await getEmiImpl(profileId, result.id)), stale: result.stale }
  })
}

export function handleDeleteEmi(
  request: Request,
  emiId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = emiIdSchema.parse(await readMutationInput(request, { emiId }))
    return deleteEmiImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/emis/$emiId')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetEmi(request, params.emiId),
      PATCH: ({ request, params }) => handleUpdateEmi(request, params.emiId),
      DELETE: ({ request, params }) => handleDeleteEmi(request, params.emiId),
    },
  },
})
