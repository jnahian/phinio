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

export interface SerializedNotification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: Date
}

function serialize(n: {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: Date | null
  createdAt: Date
}): SerializedNotification {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.readAt !== null,
    createdAt: n.createdAt,
  }
}

interface CreateNotificationArgs {
  profileId: string
  type: string
  title: string
  body: string
  link?: string | null
  dedupeKey: string
}

/**
 * Idempotent notification create. Returns `created: true` only when a new row
 * is inserted — callers use this to gate expensive side-effects like sending
 * a web-push, so a duplicate call within the dedupe window is a no-op.
 */
export async function createNotification(
  args: CreateNotificationArgs,
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.notification.findUnique({
    where: {
      profileId_dedupeKey: {
        profileId: args.profileId,
        dedupeKey: args.dedupeKey,
      },
    },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false }

  try {
    const row = await prisma.notification.create({
      data: {
        profileId: args.profileId,
        type: args.type,
        title: args.title,
        body: args.body,
        link: args.link ?? null,
        dedupeKey: args.dedupeKey,
      },
      select: { id: true },
    })
    return { id: row.id, created: true }
  } catch {
    // Race: another process inserted the same (profileId, dedupeKey) between
    // the findUnique above and our create. Re-read and treat as not-created.
    const raced = await prisma.notification.findUnique({
      where: {
        profileId_dedupeKey: {
          profileId: args.profileId,
          dedupeKey: args.dedupeKey,
        },
      },
      select: { id: true },
    })
    if (!raced) throw new Error('Failed to create notification')
    return { id: raced.id, created: false }
  }
}

export async function listNotificationsImpl(profileId: string) {
  const rows = await prisma.notification.findMany({
    where: { profileId },
    orderBy: [
      { readAt: { sort: 'asc', nulls: 'first' } },
      { createdAt: 'desc' },
    ],
    take: 50,
  })
  return rows.map(serialize)
}

export async function unreadNotificationCountImpl(profileId: string) {
  const count = await prisma.notification.count({
    where: { profileId, readAt: null },
  })
  return { count }
}

export async function markNotificationReadImpl(profileId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, profileId, readAt: null },
    data: { readAt: new Date() },
  })
  return { id, updated: result.count }
}

export async function markAllNotificationsReadImpl(profileId: string) {
  const result = await prisma.notification.updateMany({
    where: { profileId, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: result.count }
}
