import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { listNotificationsImpl } from '#/server/notifications.impl'

export function handleListNotifications(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return listNotificationsImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/notifications/')({
  server: {
    handlers: {
      GET: ({ request }) => handleListNotifications(request),
    },
  },
})
