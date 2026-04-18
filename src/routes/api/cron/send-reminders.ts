import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { createNotification } from '#/server/notifications.impl'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { buildWebPushConfig, sendWebPush } from '#/server/web-push'
import type { PushPayload } from '#/server/web-push'

/**
 * Protected cron endpoint. Scans upcoming + overdue EMI payments and DPS
 * installments, creates a Notification row for each (idempotent via dedupeKey),
 * and sends a Web Push to every subscription tied to the owning profile.
 *
 * Invoke from an external scheduler (Vercel Cron / GitHub Actions / host cron)
 * with `Authorization: Bearer ${CRON_SECRET}`.
 */
export const Route = createFileRoute('/api/cron/send-reminders')({
  server: {
    handlers: {
      POST: ({ request }) => handleCron(request),
      GET: ({ request }) => handleCron(request),
    },
  },
})

async function handleCron(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return json({ error: 'CRON_SECRET not configured' }, 500)
  }
  const auth = request.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${expected}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const maybeConfig = buildWebPushConfig()
  if (!maybeConfig) {
    return json({ error: 'VAPID keys not configured' }, 500)
  }
  const pushConfig = maybeConfig

  const now = new Date()
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const emiDueSoon = await prisma.emiPayment.findMany({
    where: {
      status: { not: 'paid' },
      dueDate: { gte: now, lte: in3Days },
    },
    include: {
      emi: { select: { label: true } },
      profile: { select: { preferredCurrency: true } },
    },
  })

  const emiOverdue = await prisma.emiPayment.findMany({
    where: {
      status: { not: 'paid' },
      dueDate: { lt: now },
    },
    include: {
      emi: { select: { label: true } },
      profile: { select: { preferredCurrency: true } },
    },
  })

  const dpsDueSoon = await prisma.investmentDeposit.findMany({
    where: {
      status: { not: 'paid' },
      dueDate: { gte: now, lte: in3Days },
      investment: { mode: 'scheduled' },
    },
    include: {
      investment: { select: { id: true, name: true } },
      profile: { select: { preferredCurrency: true } },
    },
  })

  const dpsOverdue = await prisma.investmentDeposit.findMany({
    where: {
      status: { not: 'paid' },
      dueDate: { lt: now },
      investment: { mode: 'scheduled' },
    },
    include: {
      investment: { select: { id: true, name: true } },
      profile: { select: { preferredCurrency: true } },
    },
  })

  const scanned =
    emiDueSoon.length +
    emiOverdue.length +
    dpsDueSoon.length +
    dpsOverdue.length
  let created = 0
  let pushed = 0
  let expired = 0

  async function dispatch(args: {
    profileId: string
    type: string
    title: string
    body: string
    link: string
    dedupeKey: string
  }) {
    const res = await createNotification(args)
    if (!res.created) return
    created += 1

    const subs = await prisma.pushSubscription.findMany({
      where: { profileId: args.profileId },
    })
    const payload: PushPayload = {
      title: args.title,
      body: args.body,
      link: args.link,
      dedupeKey: args.dedupeKey,
      notificationId: res.id,
    }

    await Promise.all(
      subs.map(async (s) => {
        const result = await sendWebPush(pushConfig, s, payload)
        if (result.gone) {
          await prisma.pushSubscription.deleteMany({
            where: { endpoint: s.endpoint },
          })
          expired += 1
          return
        }
        if (result.ok) pushed += 1
      }),
    )
  }

  for (const p of emiDueSoon) {
    const currency = p.profile.preferredCurrency as Currency
    await dispatch({
      profileId: p.profileId,
      type: 'emi.payment.due',
      title: 'Payment due soon',
      body: `${p.emi.label} — ${formatCurrency(p.emiAmount, currency)} due ${p.dueDate.toLocaleDateString()}`,
      link: `/app/emis/${p.emiId}`,
      dedupeKey: `payment-due:${p.id}`,
    })
  }

  for (const p of emiOverdue) {
    const currency = p.profile.preferredCurrency as Currency
    await dispatch({
      profileId: p.profileId,
      type: 'emi.payment.overdue',
      title: 'Payment overdue',
      body: `${p.emi.label} — ${formatCurrency(p.emiAmount, currency)} was due ${p.dueDate.toLocaleDateString()}`,
      link: `/app/emis/${p.emiId}`,
      dedupeKey: `payment-overdue:${p.id}`,
    })
  }

  for (const d of dpsDueSoon) {
    const currency = d.profile.preferredCurrency as Currency
    await dispatch({
      profileId: d.profileId,
      type: 'dps.installment.due',
      title: 'DPS deposit due soon',
      body: `${d.investment.name} — ${formatCurrency(d.amount, currency)} due ${d.dueDate!.toLocaleDateString()}`,
      link: `/app/investments/dps/${d.investmentId}`,
      dedupeKey: `dps-due:${d.id}`,
    })
  }

  for (const d of dpsOverdue) {
    const currency = d.profile.preferredCurrency as Currency
    await dispatch({
      profileId: d.profileId,
      type: 'dps.installment.overdue',
      title: 'DPS deposit overdue',
      body: `${d.investment.name} — ${formatCurrency(d.amount, currency)} was due ${d.dueDate!.toLocaleDateString()}`,
      link: `/app/investments/dps/${d.investmentId}`,
      dedupeKey: `dps-overdue:${d.id}`,
    })
  }

  return json({ scanned, created, pushed, expired })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
