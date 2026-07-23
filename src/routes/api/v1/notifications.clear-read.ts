import { createFileRoute } from '@tanstack/react-router'
import { clearReadNotificationsSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { clearReadNotificationsImpl } from '#/server/notifications.impl'

export function handleClearRead(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = clearReadNotificationsSchema.parse(
      await readMutationInput(request),
    )
    return clearReadNotificationsImpl(profileId, input)
  })
}

export const Route = createFileRoute('/api/v1/notifications/clear-read')({
  server: {
    handlers: {
      POST: ({ request }) => handleClearRead(request),
    },
  },
})
