import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'

export async function requireProfileId(): Promise<string> {
  const headers = new Headers(getRequestHeaders())
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error('Unauthorized')
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!profile) throw new Error('Profile not found')
  return profile.id
}

export interface SavePushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
}

export async function savePushSubscriptionImpl(
  profileId: string,
  data: SavePushSubscriptionInput,
) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: {
      profileId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth: data.auth,
      userAgent: data.userAgent ?? null,
    },
    update: {
      profileId,
      p256dh: data.p256dh,
      auth: data.auth,
      userAgent: data.userAgent ?? null,
      lastSeenAt: new Date(),
    },
  })
  return { ok: true as const }
}

export async function deletePushSubscriptionImpl(
  profileId: string,
  endpoint: string,
) {
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, profileId },
  })
  return { ok: true as const }
}

export async function hasActivePushSubscriptionImpl(profileId: string) {
  const count = await prisma.pushSubscription.count({ where: { profileId } })
  return { count }
}
