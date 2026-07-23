import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { upcomingPaymentsImpl } from '#/server/emis.impl'

export function handleUpcomingPayments(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return upcomingPaymentsImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/emis/upcoming')({
  server: {
    handlers: {
      GET: ({ request }) => handleUpcomingPayments(request),
    },
  },
})
