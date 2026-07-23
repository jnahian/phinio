import { createFileRoute } from '@tanstack/react-router'
import { markNotificationReadSchema } from '#/lib/validators'
import {
  ApiError,
  api,
  readMutationInput,
  requireApiProfile,
} from '#/server/api-v1'
import { markNotificationReadImpl } from '#/server/notifications.impl'

export function handleMarkRead(
  request: Request,
  id: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markNotificationReadSchema.parse(
      await readMutationInput(request, { id }),
    )
    const result = await markNotificationReadImpl(profileId, input)
    // The impl's updateMany silently matches zero rows for a foreign or
    // already-read notification — surface that as 404 instead of a fake 200.
    if (result.updated === 0) {
      throw new ApiError(404, 'not_found', 'Notification not found')
    }
    return result
  })
}

export const Route = createFileRoute('/api/v1/notifications/$id/read')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleMarkRead(request, params.id),
    },
  },
})
