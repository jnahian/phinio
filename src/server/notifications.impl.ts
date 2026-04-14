import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'

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
 * Idempotent notification create. Safe to call multiple times with the same
 * dedupeKey — the unique (profileId, dedupeKey) constraint prevents duplicates
 * and we silently ignore the conflict.
 */
export async function createNotification(args: CreateNotificationArgs) {
  await prisma.notification.upsert({
    where: {
      profileId_dedupeKey: {
        profileId: args.profileId,
        dedupeKey: args.dedupeKey,
      },
    },
    create: {
      profileId: args.profileId,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link ?? null,
      dedupeKey: args.dedupeKey,
    },
    // No-op update: keep the existing row and its read state.
    update: {},
  })
}

/**
 * Scan the user's data for things that warrant a notification right now and
 * insert any that don't already exist. This is the "background job" for
 * time-based notifications (payment due / overdue), executed lazily whenever
 * the bell endpoint is hit. Cheap and idempotent.
 */
export async function syncDerivedNotifications(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { preferredCurrency: true },
  })
  const currency = (profile?.preferredCurrency ?? 'BDT') as Currency

  const now = new Date()
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const dueSoon = await prisma.emiPayment.findMany({
    where: {
      profileId,
      status: { not: 'paid' },
      dueDate: { gte: now, lte: in3Days },
    },
    include: { emi: { select: { label: true } } },
  })

  const overdue = await prisma.emiPayment.findMany({
    where: {
      profileId,
      status: { not: 'paid' },
      dueDate: { lt: now },
    },
    include: { emi: { select: { label: true } } },
  })

  for (const p of dueSoon) {
    await createNotification({
      profileId,
      type: 'emi.payment.due',
      title: 'Payment due soon',
      body: `${p.emi.label} — ${formatCurrency(p.emiAmount, currency)} due ${p.dueDate.toLocaleDateString()}`,
      link: `/app/emis/${p.emiId}`,
      dedupeKey: `payment-due:${p.id}`,
    })
  }

  for (const p of overdue) {
    await createNotification({
      profileId,
      type: 'emi.payment.overdue',
      title: 'Payment overdue',
      body: `${p.emi.label} — ${formatCurrency(p.emiAmount, currency)} was due ${p.dueDate.toLocaleDateString()}`,
      link: `/app/emis/${p.emiId}`,
      dedupeKey: `payment-overdue:${p.id}`,
    })
  }
}

export async function listNotificationsImpl(profileId: string) {
  await syncDerivedNotifications(profileId)
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
  await syncDerivedNotifications(profileId)
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
