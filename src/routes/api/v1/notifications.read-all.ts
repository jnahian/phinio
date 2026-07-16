import { createFileRoute } from '@tanstack/react-router'
import { markAllNotificationsReadSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { markAllNotificationsReadImpl } from '#/server/notifications.impl'

export function handleMarkAllRead(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markAllNotificationsReadSchema.parse(
      await readMutationInput(request),
    )
    return markAllNotificationsReadImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/notifications/read-all')({
  server: {
    handlers: {
      POST: ({ request }) => handleMarkAllRead(request),
    },
  },
})
