import { createFileRoute } from '@tanstack/react-router'
import { api, requireApiProfile } from '#/server/api-v1'
import { getDashboardStatsImpl } from '#/server/dashboard.impl'

export function handleDashboard(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    return getDashboardStatsImpl(profileId)
  })
}

export const Route = createFileRoute('/api/v1/dashboard')({
  server: {
    handlers: {
      GET: ({ request }) => handleDashboard(request),
    },
  },
})
