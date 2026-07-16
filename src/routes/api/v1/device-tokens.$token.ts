import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { api, requireApiProfile } from '#/server/api-v1'

export function handleDeleteDeviceToken(
  request: Request,
  token: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const result = await prisma.deviceToken.deleteMany({
      where: { profileId, token },
    })
    return { deleted: result.count }
  })
}

export const Route = createFileRoute('/api/v1/device-tokens/$token')({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        handleDeleteDeviceToken(request, params.token),
    },
  },
})
