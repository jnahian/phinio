import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { prisma } from '#/db'
import { Prisma } from '#/generated/prisma/client'
import type { PrismaClient } from '#/generated/prisma/client'
import type { Currency } from '#/lib/currency'

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
  // Set when the field is monetary. The UI renders the stored value with this
  // currency's symbol so history doesn't flip when the user later switches
  // their preferred currency.
  currency?: Currency | null
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

// Resolves the profile's currency at call time. Kept here so every impl that
// logs money-field diffs has one canonical place to ask.
export async function getProfileCurrency(
  client: Pick<PrismaClient, 'profile'>,
  profileId: string,
): Promise<Currency> {
  const p = await client.profile.findUnique({
    where: { id: profileId },
    select: { preferredCurrency: true },
  })
  return (p?.preferredCurrency ?? 'BDT') as Currency
}

// ---------------------------------------------------------------------------
// Diff helper — callers supply a list of fields with labels and optional
// formatters, and we return only the changed entries.
// ---------------------------------------------------------------------------

export interface DiffFieldSpec<T> {
  key: keyof T
  label: string
  // Formatters accept `unknown` so that a Prisma-shaped `before` and a
  // loosely-typed `after` (e.g. input strings) can share the same spec.
  format?: (value: unknown) => string | null
  // When true, fmtMoney is used by default and the passed `currency` is
  // attached to the resulting change entry.
  isMoney?: boolean
}

function defaultFormat(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export function diffFields<T extends object>(
  before: T,
  after: Partial<Record<keyof T, unknown>>,
  specs: Array<DiffFieldSpec<T>>,
  currency?: Currency,
): Array<ActivityChange> {
  const changes: Array<ActivityChange> = []
  for (const spec of specs) {
    if (!(spec.key in after)) continue
    const fmt = spec.format ?? (spec.isMoney ? fmtMoney : defaultFormat)
    const fromVal = fmt(before[spec.key])
    const toVal = fmt(after[spec.key])
    if (fromVal !== toVal) {
      const change: ActivityChange = {
        field: spec.label,
        from: fromVal,
        to: toVal,
      }
      if (spec.isMoney && currency) change.currency = currency
      changes.push(change)
    }
  }
  return changes
}

// Render helpers shared across impls so the stored `from`/`to` strings are
// consistent with what the UI displays.

// Prisma.Decimal-aware so Decimal(15,2) values keep their precision. Falls
// back to String(v) on anything Decimal can't parse (e.g. NaN).
export function fmtMoney(v: unknown): string | null {
  if (v === null || v === undefined) return null
  try {
    return new Prisma.Decimal(v as string | number).toFixed(2)
  } catch {
    return String(v)
  }
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

// Defence-in-depth parse of the JSON blob. Only our own server code writes it,
// but a bad row shouldn't crash the render.
const activityChangeSchema = z.object({
  field: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  currency: z.enum(['BDT', 'USD']).nullish(),
})
const activityChangesSchema = z.array(activityChangeSchema)

function parseChanges(raw: unknown): Array<ActivityChange> | null {
  if (raw === null || raw === undefined) return null
  const parsed = activityChangesSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
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
      changes: parseChanges(r.changes),
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
