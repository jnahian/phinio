import { timingSafeEqual } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { createNotification } from '#/server/notifications.impl'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { buildWebPushConfig, sendWebPush } from '#/server/web-push'
import type { PushPayload, PushSubscriptionRow } from '#/server/web-push'

/**
 * Protected cron endpoint. Scans upcoming + overdue EMI payments and DPS
 * installments, creates a Notification row for each (idempotent via dedupeKey),
 * and sends a Web Push to every subscription tied to the owning profile.
 *
 * Invoked by Vercel Cron (GET) with `Authorization: Bearer ${CRON_SECRET}`.
 */
export const Route = createFileRoute('/api/cron/send-reminders')({
  server: {
    handlers: {
      GET: ({ request }) => handleCron(request),
    },
  },
})

// Stable, server-locale-independent date format for notification bodies.
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function fmtDate(d: Date): string {
  return dateFmt.format(d)
}

function verifyBearer(header: string, expected: string): boolean {
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return false
  const provided = header.slice(prefix.length)
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDayPlus(days: number): Date {
  const d = startOfToday()
  d.setDate(d.getDate() + days)
  d.setHours(23, 59, 59, 999)
  return d
}

export async function handleCron(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return json({ error: 'CRON_SECRET not configured' }, 500)
  }
  const authHeader = request.headers.get('authorization') ?? ''
  if (!verifyBearer(authHeader, expected)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const maybeConfig = buildWebPushConfig()
  if (!maybeConfig) {
    return json({ error: 'VAPID keys not configured' }, 500)
  }
  const pushConfig = maybeConfig

  // Day-boundary windows: "due soon" covers today through end of day +3;
  // "overdue" is strictly before today (midnight). Avoids race between a
  // midnight `dueDate` flipping to overdue within hours of the cron firing.
  const todayStart = startOfToday()
  const dueSoonEnd = endOfDayPlus(3)

  const [emiDueSoon, emiOverdue, dpsDueSoon, dpsOverdue] = await Promise.all([
    prisma.emiPayment.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: { gte: todayStart, lte: dueSoonEnd },
      },
      include: {
        emi: { select: { label: true } },
        profile: { select: { preferredCurrency: true } },
      },
    }),
    prisma.emiPayment.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: { lt: todayStart },
      },
      include: {
        emi: { select: { label: true } },
        profile: { select: { preferredCurrency: true } },
      },
    }),
    prisma.investmentDeposit.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: { gte: todayStart, lte: dueSoonEnd },
        investment: { mode: 'scheduled' },
      },
      include: {
        investment: { select: { id: true, name: true } },
        profile: { select: { preferredCurrency: true } },
      },
    }),
    prisma.investmentDeposit.findMany({
      where: {
        status: { not: 'paid' },
        dueDate: { lt: todayStart },
        investment: { mode: 'scheduled' },
      },
      include: {
        investment: { select: { id: true, name: true } },
        profile: { select: { preferredCurrency: true } },
      },
    }),
  ])

  interface Candidate {
    profileId: string
    type: string
    title: string
    body: string
    link: string
    dedupeKey: string
  }

  const candidates: Candidate[] = []

  for (const p of emiDueSoon) {
    const currency = p.profile.preferredCurrency as Currency
    candidates.push({
      profileId: p.profileId,
      type: 'emi.payment.due',
      title: 'Payment due soon',
      body: `${p.emi.label} — ${formatCurrency(p.emiAmount, currency)} due ${fmtDate(p.dueDate)}`,
      link: `/app/emis/${p.emiId}`,
      dedupeKey: `payment-due:${p.id}`,
    })
  }
  for (const p of emiOverdue) {
    const currency = p.profile.preferredCurrency as Currency
    candidates.push({
      profileId: p.profileId,
      type: 'emi.payment.overdue',
      title: 'Payment overdue',
      body: `${p.emi.label} — ${formatCurrency(p.emiAmount, currency)} was due ${fmtDate(p.dueDate)}`,
      link: `/app/emis/${p.emiId}`,
      dedupeKey: `payment-overdue:${p.id}`,
    })
  }
  for (const d of dpsDueSoon) {
    const currency = d.profile.preferredCurrency as Currency
    candidates.push({
      profileId: d.profileId,
      type: 'dps.installment.due',
      title: 'DPS deposit due soon',
      body: `${d.investment.name} — ${formatCurrency(d.amount, currency)} due ${fmtDate(d.dueDate!)}`,
      link: `/app/investments/dps/${d.investmentId}`,
      dedupeKey: `dps-due:${d.id}`,
    })
  }
  for (const d of dpsOverdue) {
    const currency = d.profile.preferredCurrency as Currency
    candidates.push({
      profileId: d.profileId,
      type: 'dps.installment.overdue',
      title: 'DPS deposit overdue',
      body: `${d.investment.name} — ${formatCurrency(d.amount, currency)} was due ${fmtDate(d.dueDate!)}`,
      link: `/app/investments/dps/${d.investmentId}`,
      dedupeKey: `dps-overdue:${d.id}`,
    })
  }

  const scanned = candidates.length
  let created = 0
  let pushed = 0
  let expired = 0
  let failed = 0

  // Insert notifications serially (cheap, preserves dedupe semantics) and
  // collect only newly-created ones for push dispatch.
  interface PushJob {
    profileId: string
    payload: PushPayload
  }
  const pushJobs: PushJob[] = []

  for (const c of candidates) {
    const res = await createNotification(c)
    if (!res.created) continue
    created += 1
    pushJobs.push({
      profileId: c.profileId,
      payload: {
        title: c.title,
        body: c.body,
        link: c.link,
        dedupeKey: c.dedupeKey,
        notificationId: res.id,
      },
    })
  }

  if (pushJobs.length > 0) {
    // Batch subscription lookup: one query per unique profile.
    const profileIds = [...new Set(pushJobs.map((j) => j.profileId))]
    const subs = await prisma.pushSubscription.findMany({
      where: { profileId: { in: profileIds } },
    })
    const subsByProfile = new Map<string, PushSubscriptionRow[]>()
    for (const s of subs) {
      const list = subsByProfile.get(s.profileId) ?? []
      list.push(s)
      subsByProfile.set(s.profileId, list)
    }

    const expiredEndpoints = new Set<string>()

    const sendResults = await Promise.all(
      pushJobs.flatMap((job) => {
        const list = subsByProfile.get(job.profileId) ?? []
        return list.map(async (s) => {
          const result = await sendWebPush(pushConfig, s, job.payload)
          return { endpoint: s.endpoint, result }
        })
      }),
    )

    for (const { endpoint, result } of sendResults) {
      if (result.gone) {
        expiredEndpoints.add(endpoint)
      } else if (result.ok) {
        pushed += 1
      } else {
        failed += 1
      }
    }

    if (expiredEndpoints.size > 0) {
      const del = await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: [...expiredEndpoints] } },
      })
      expired = del.count
    }
  }

  return json({ scanned, created, pushed, expired, failed })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
