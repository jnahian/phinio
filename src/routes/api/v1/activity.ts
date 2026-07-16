import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { api, requireApiProfile } from '#/server/api-v1'
import { listActivityImpl } from '#/server/activity-log.impl'

const activityQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export function handleListActivity(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const url = new URL(request.url)
    const query = activityQuerySchema.parse({
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })
    return listActivityImpl(profileId, query)
  })
}

export const Route = createFileRoute('/api/v1/activity')({
  server: {
    handlers: {
      GET: ({ request }) => handleListActivity(request),
    },
  },
})
