import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { unreadNotificationCountImpl } from '#/server/notifications.impl'

export function handleUnreadCount(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return unreadNotificationCountImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/notifications/unread-count')({
  server: {
    handlers: {
      GET: ({ request }) => handleUnreadCount(request),
    },
  },
})
