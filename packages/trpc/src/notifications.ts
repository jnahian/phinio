import type { PrismaClient } from '@phinio/db'

/**
 * Public shape returned by the notifications `list` query. The `read` boolean
 * is derived from `readAt` so the client never has to compare timestamps.
 */
export interface SerializedNotification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: Date
}

export interface CreateNotificationArgs {
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
 *
 * Lives in `@phinio/trpc` (not the `notifications` router) because the cron
 * route at `apps/web/src/routes/api/cron/send-reminders.ts` calls it directly
 * — it isn't an authenticated user action and doesn't run through tRPC.
 */
export async function createNotification(
  prisma: PrismaClient,
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
  } catch (err) {
    // Only treat unique-constraint violations as a "lost race" — any other
    // error (connection, permission, etc.) must propagate so the caller sees
    // the real failure instead of a generic re-read miss.
    if (!isUniqueViolation(err)) throw err
    const raced = await prisma.notification.findUnique({
      where: {
        profileId_dedupeKey: {
          profileId: args.profileId,
          dedupeKey: args.dedupeKey,
        },
      },
      select: { id: true },
    })
    if (!raced) throw err
    return { id: raced.id, created: false }
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  )
}

export function serializeNotification(n: {
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
