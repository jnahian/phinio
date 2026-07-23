import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { prisma } from '#/db'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'

const registerSchema = z.object({
  token: z.string().min(1).max(200),
  platform: z.literal('ios').default('ios'),
})

export function handleRegisterDeviceToken(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = registerSchema.parse(await readMutationInput(request))
    // Upsert on token: a device that re-registers after a re-login moves to
    // the new profile instead of duplicating.
    return prisma.deviceToken.upsert({
      where: { token: input.token },
      create: { profileId, token: input.token, platform: input.platform },
      update: { profileId },
    })
  })
}

export const Route = createFileRoute('/api/v1/device-tokens')({
  server: {
    handlers: {
      POST: ({ request }) => handleRegisterDeviceToken(request),
    },
  },
})
