import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { Prisma } from '#/generated/prisma/client'
import type { PrismaClient } from '#/generated/prisma/client'

// Either the root client or a $transaction tx client — both expose
// `.activityLog.create`, which is all we need here.
export type ActivityLogWriter = Pick<PrismaClient, 'activityLog'>

export type ActivityAction = 'create' | 'update' | 'delete'

export type ActivityEntityType =
  | 'investment'
  | 'investment_deposit'
  | 'investment_withdrawal'
  | 'emi'
  | 'emi_payment'
  | 'profile'

export interface ActivityChange {
  field: string
  from: string | null
  to: string | null
}

export interface LogActivityArgs {
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string | null
  entityLabel: string
  summary: string
  changes?: Array<ActivityChange> | null
}

export async function logActivity(
  client: ActivityLogWriter,
  profileId: string,
  args: LogActivityArgs,
): Promise<void> {
  await client.activityLog.create({
    data: {
      profileId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      entityLabel: args.entityLabel,
      summary: args.summary,
      changes:
        args.changes && args.changes.length > 0
          ? (args.changes as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  })
}

// ---------------------------------------------------------------------------
// Diff helper — callers supply a list of fields with labels and optional
// formatters, and we return only the changed entries. Callers format money
// and dates to display strings themselves so the stored diff is render-ready.
// ---------------------------------------------------------------------------

export interface DiffFieldSpec<T> {
  key: keyof T
  label: string
  format?: (value: T[keyof T]) => string | null
}

function defaultFormat(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  specs: Array<DiffFieldSpec<T>>,
): Array<ActivityChange> {
  const changes: Array<ActivityChange> = []
  for (const spec of specs) {
    if (!(spec.key in after)) continue
    const fmt = spec.format ?? defaultFormat
    const fromVal = fmt(before[spec.key])
    const toVal = fmt(after[spec.key] as T[keyof T])
    if (fromVal !== toVal) {
      changes.push({ field: spec.label, from: fromVal, to: toVal })
    }
  }
  return changes
}

// Render helpers shared across impls so the stored `from`/`to` strings are
// consistent with what the UI displays.
export function fmtMoney(v: unknown): string | null {
  if (v === null || v === undefined) return null
  // Keep two decimals, no currency symbol — the UI prepends the user's currency
  // when rendering the log so historical entries respect the current symbol.
  const n = typeof v === 'number' ? v : Number(String(v))
  if (Number.isNaN(n)) return String(v)
  return n.toFixed(2)
}

export function fmtDate(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toISOString().slice(0, 10)
}

export function fmtText(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length === 0 ? null : s
}

// ---------------------------------------------------------------------------
// List — paginated, cursor-based
// ---------------------------------------------------------------------------

export interface ActivityListQuery {
  cursor?: string | null
  limit?: number
}

export interface ActivityLogItem {
  id: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string | null
  entityLabel: string
  summary: string
  changes: Array<ActivityChange> | null
  createdAt: Date
}

export interface ActivityListResult {
  items: Array<ActivityLogItem>
  nextCursor: string | null
}

export async function listActivityImpl(
  profileId: string,
  data: ActivityListQuery,
): Promise<ActivityListResult> {
  const limit = Math.min(Math.max(data.limit ?? 30, 1), 100)
  const rows = await prisma.activityLog.findMany({
    where: { profileId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(data.cursor ? { cursor: { id: data.cursor }, skip: 1 } : {}),
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  return {
    items: page.map((r) => ({
      id: r.id,
      action: r.action as ActivityAction,
      entityType: r.entityType as ActivityEntityType,
      entityId: r.entityId,
      entityLabel: r.entityLabel,
      summary: r.summary,
      changes: (r.changes as Array<ActivityChange> | null) ?? null,
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  }
}

// Shared session → profileId, mirrors the helper in other .impl files.
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
