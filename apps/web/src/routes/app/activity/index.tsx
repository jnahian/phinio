import { useEffect, useId, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  CloudOff,
  CreditCard,
  History,
  PencilLine,
  PiggyBank,
  Plus,
  TrendingUp,
  Trash2,
  User,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import { formatCurrency } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'
import type { Currency } from '#/lib/currency'
import {
  activityInfiniteQueryOptions,
  useActivityLogQuery,
} from '#/hooks/useActivityLog'
import type {
  ActivityChange,
  ActivityEntityType,
  ActivityAction,
  ActivityLogItem,
} from '@phinio/trpc/activity-log'

export const Route = createFileRoute('/app/activity/')({
  staticData: { title: 'pageTitles.activity', backTo: '/app/profile' },
  loader: ({ context }) => {
    void context.queryClient.prefetchInfiniteQuery(
      activityInfiniteQueryOptions(),
    )
  },
  component: ActivityScreen,
})

const ENTITY_META: Record<ActivityEntityType, { icon: LucideIcon }> = {
  investment: { icon: TrendingUp },
  investment_deposit: { icon: PiggyBank },
  investment_withdrawal: { icon: Wallet },
  emi: { icon: CreditCard },
  emi_payment: { icon: CalendarClock },
  profile: { icon: User },
}

const ACTION_META: Record<
  ActivityAction,
  { icon: LucideIcon; badgeClass: string }
> = {
  create: {
    icon: Plus,
    badgeClass: 'bg-primary-container/20 text-primary-fixed-dim',
  },
  update: {
    icon: PencilLine,
    badgeClass: 'bg-[#6a3fc7]/25 text-[#c4a8ff]',
  },
  delete: {
    icon: Trash2,
    badgeClass: 'bg-[#8a2a2a]/25 text-[#ff9e9e]',
  },
}

function ActivityScreen() {
  const { t } = useTranslation('activity')
  const { t: tCommon } = useTranslation('common')
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivityLogQuery()
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Auto-fetch the next page when the sentinel scrolls into view. The
  // rootMargin gives us ~one card-height of head start so pages land before
  // the user hits the end of the list.
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const items = data?.pages.flatMap((p) => p.items) ?? []

  if (isError && items.length === 0) {
    return (
      <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
        <EmptyState
          icon={<CloudOff className="h-7 w-7" strokeWidth={1.75} />}
          title={t('errors.loadFailed')}
          description={t('errors.checkConnection')}
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="btn-primary"
            >
              {tCommon('actions.retry')}
            </button>
          }
        />
      </main>
    )
  }

  if (isLoading) {
    return (
      <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card variant="default">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
        <EmptyState
          icon={<History className="h-7 w-7" strokeWidth={1.75} />}
          title={t('empty.title')}
          description={t('empty.description')}
        />
      </main>
    )
  }

  const groups = groupByDay(items, {
    today: t('today'),
    yesterday: t('yesterday'),
    locale: profile.preferredLanguage,
  })

  return (
    <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="label-sm mb-2 px-1 normal-case tracking-wide text-on-surface-variant">
              {group.label}
            </h2>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li key={item.id}>
                  <ActivityItemCard item={item} currency={currency} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="mt-6 flex items-center justify-center py-4"
          aria-hidden={!isFetchingNextPage}
        >
          {isFetchingNextPage && (
            <span
              role="status"
              aria-label={t('loadingMore')}
              className="h-5 w-5 animate-spin rounded-full border-2 border-on-surface-variant/20 border-t-on-surface-variant"
            />
          )}
        </div>
      )}
    </main>
  )
}

interface ActivityItemCardProps {
  item: ActivityLogItem
  currency: Currency
}

function ActivityItemCard({ item, currency }: ActivityItemCardProps) {
  const { t } = useTranslation('activity')
  const [open, setOpen] = useState(false)
  const changesId = useId()
  const entity = ENTITY_META[item.entityType]
  const action = ACTION_META[item.action]
  const EntityIcon = entity.icon
  const ActionIcon = action.icon
  const hasChanges = (item.changes?.length ?? 0) > 0

  return (
    <Card variant="default" className="p-4">
      <button
        type="button"
        disabled={!hasChanges}
        aria-expanded={hasChanges ? open : undefined}
        aria-controls={hasChanges ? changesId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-start gap-3 text-left',
          hasChanges ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <div
          className={cn(
            'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
            action.badgeClass,
          )}
        >
          <EntityIcon className="h-4 w-4" strokeWidth={1.75} />
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface-container-highest">
            <ActionIcon className="h-2.5 w-2.5" strokeWidth={2.25} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="body-md text-on-surface">{item.summary}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
            <span>{t(`entities.${item.entityType}`)}</span>
            <span>•</span>
            <time dateTime={new Date(item.createdAt).toISOString()}>
              {formatTime(item.createdAt)}
            </time>
          </div>
        </div>

        {hasChanges && (
          <ChevronDown
            className={cn(
              'mt-1 h-4 w-4 flex-shrink-0 text-on-surface-variant transition-transform',
              open && 'rotate-180',
            )}
            strokeWidth={1.75}
          />
        )}
      </button>

      {hasChanges && open && (
        <ul
          id={changesId}
          className="mt-3 space-y-2 border-t border-outline-variant/15 pt-3"
        >
          {item.changes!.map((change, idx) => (
            <ChangeRow key={idx} change={change} currency={currency} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function ChangeRow({
  change,
  currency,
}: {
  change: ActivityChange
  currency: Currency
}) {
  const { locale } = useFormatter()
  // Money changes carry the currency that was active when the change was
  // recorded; fall back to the user's current preference for legacy rows.
  const moneyCurrency = change.currency ?? null
  const isMoney = moneyCurrency !== null
  const from = formatValue(
    change.from,
    isMoney,
    moneyCurrency ?? currency,
    locale,
  )
  const to = formatValue(change.to, isMoney, moneyCurrency ?? currency, locale)

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="label-sm normal-case tracking-wide text-on-surface-variant">
        {change.field}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-md bg-surface-container-low px-1.5 py-0.5 font-mono text-xs text-on-surface-variant line-through">
          {from}
        </span>
        <ArrowRight className="h-3 w-3 text-on-surface-variant/60" />
        <span className="rounded-md bg-primary-container/20 px-1.5 py-0.5 font-mono text-xs text-primary-fixed-dim">
          {to}
        </span>
      </span>
    </li>
  )
}

function formatValue(
  value: string | null,
  isMoney: boolean,
  currency: Currency,
  locale: 'en' | 'bn',
): string {
  if (value === null) return '—'
  if (isMoney) return formatCurrency(value, currency, { locale })
  return value
}

// ---------------------------------------------------------------------------
// Helpers: grouping + time formatting
// ---------------------------------------------------------------------------

interface DayGroup {
  key: string
  label: string
  items: Array<ActivityLogItem>
}

function groupByDay(
  items: Array<ActivityLogItem>,
  labels: { today: string; yesterday: string; locale: 'en' | 'bn' },
): Array<DayGroup> {
  const today = startOfDay(new Date())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const groups = new Map<string, DayGroup>()
  const dateLocale = labels.locale === 'bn' ? 'bn-BD' : 'en-GB'

  for (const item of items) {
    const d = startOfDay(new Date(item.createdAt))
    const key = d.toISOString().slice(0, 10)
    if (!groups.has(key)) {
      let label: string
      if (d.getTime() === today.getTime()) label = labels.today
      else if (d.getTime() === yesterday.getTime()) label = labels.yesterday
      else
        label = d.toLocaleDateString(dateLocale, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
        })
      groups.set(key, { key, label, items: [] })
    }
    groups.get(key)!.items.push(item)
  }

  return Array.from(groups.values())
}

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatTime(value: Date | string): string {
  const d = new Date(value)
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
