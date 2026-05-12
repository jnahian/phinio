import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  CloudOff,
  CreditCard,
} from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { FilterPills } from '#/components/ui/FilterPills'
import type { FilterPill } from '#/components/ui/FilterPills'
import { ProgressBar } from '#/components/ui/ProgressBar'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import type { Currency } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'
import { emisListQueryOptions, useEmisQuery } from '#/hooks/useEmis'
import type { EmiType } from '@phinio/validators'

type TypeFilter = EmiType | 'all'
type StatusFilter = 'active' | 'completed'

const TYPE_META: Record<
  EmiType,
  { typeKey: EmiType; icon: typeof Building2; badgeClass: string }
> = {
  bank_loan: {
    typeKey: 'bank_loan',
    icon: Building2,
    badgeClass: 'bg-primary-container/20 text-primary-fixed-dim',
  },
  credit_card: {
    typeKey: 'credit_card',
    icon: CreditCard,
    badgeClass: 'bg-[#6a3fc7]/25 text-[#c4a8ff]',
  },
}

export const Route = createFileRoute('/app/emis/')({
  staticData: { title: 'pageTitles.emis' },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      emisListQueryOptions({ type: 'all', status: 'active' }),
    )
  },
  component: EmisListScreen,
})

function EmisListScreen() {
  const { t } = useTranslation('emis')
  const { t: tCommon } = useTranslation('common')
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const fmt = useFormatter()

  const TYPE_PILLS: Array<FilterPill<TypeFilter>> = [
    { value: 'all', label: t('types.all') },
    { value: 'bank_loan', label: t('types.bank_loan') },
    { value: 'credit_card', label: t('types.credit_card') },
  ]

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const {
    data: emis = [],
    isLoading,
    isError,
    refetch,
  } = useEmisQuery({ type: typeFilter, status })

  // Accumulate in integer cents so summing many money strings doesn't drift
  // through float-point error. CLAUDE.md: never coerce money to JS number for
  // arithmetic — Number(...) here only crosses to int via *100 + round, and
  // we divide back at the display boundary.
  const totals = emis.reduce(
    (acc, emi) => {
      acc.monthly += Math.round(Number(emi.emiAmount) * 100)
      acc.remaining += Math.round(Number(emi.remainingBalance) * 100)
      return acc
    },
    { monthly: 0, remaining: 0 },
  )

  return (
    <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
      <Card variant="low" className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <SummaryCell
            label={
              status === 'completed' ? t('list.completed') : t('list.active')
            }
            value={fmt.number(emis.length)}
          />
          <SummaryCell
            label={t('list.monthly')}
            value={fmt.currency((totals.monthly / 100).toFixed(2), currency)}
          />
          <SummaryCell
            label={
              status === 'completed' ? t('list.paidOff') : t('list.remaining')
            }
            value={fmt.currency((totals.remaining / 100).toFixed(2), currency)}
          />
        </div>
      </Card>

      <div className="mb-4 inline-flex gap-1 rounded-full bg-surface-container-low p-1">
        <StatusTab
          active={status === 'active'}
          onClick={() => setStatus('active')}
        >
          {t('list.active')}
        </StatusTab>
        <StatusTab
          active={status === 'completed'}
          onClick={() => setStatus('completed')}
        >
          {t('list.completed')}
        </StatusTab>
      </div>

      <FilterPills
        pills={TYPE_PILLS}
        active={typeFilter}
        onChange={setTypeFilter}
        className="mb-6"
      />

      {isError && emis.length === 0 ? (
        <EmptyState
          icon={<CloudOff className="h-7 w-7" strokeWidth={1.75} />}
          title={t('list.loadFailed')}
          description={tCommon('states.errorDescription')}
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
      ) : isLoading ? (
        <ul className="space-y-3">
          {[0, 1].map((i) => (
            <li key={i}>
              <Card variant="default">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="mt-4 h-1 w-full" />
                <div className="mt-3 flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : emis.length === 0 ? (
        status === 'completed' ? (
          <EmptyState
            icon={<CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />}
            title={t('list.noCompleted')}
            description={t('list.noCompletedHint')}
          />
        ) : (
          <EmptyState
            icon={<CalendarClock className="h-7 w-7" strokeWidth={1.75} />}
            title={t('list.empty')}
            description={t('list.emptyHint')}
          />
        )
      ) : (
        <ul className="space-y-3">
          {emis.map((emi) => (
            <li key={emi.id}>
              <EmiCard emi={emi} currency={currency} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-sm normal-case tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="font-display mt-1 text-base font-bold text-on-surface">
        {value}
      </p>
    </div>
  )
}

function StatusTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'bg-surface-container-highest text-on-surface'
          : 'text-on-surface-variant hover:text-on-surface',
      )}
    >
      {children}
    </button>
  )
}

interface EmiCardProps {
  emi: {
    id: string
    label: string
    type: string
    emiAmount: string
    tenureMonths: number
    totalPayments: number
    paidCount: number
    nextDueDate: Date | string | null
    remainingBalance: string
  }
  currency: Currency
}

function EmiCard({ emi, currency }: EmiCardProps) {
  const { t } = useTranslation('emis')
  const fmt = useFormatter()
  const type = emi.type as EmiType
  const meta = TYPE_META[type]
  const Icon = meta.icon
  const progress =
    emi.totalPayments > 0 ? (emi.paidCount / emi.totalPayments) * 100 : 0
  const formatDue = (d: Date | string | null): string => {
    if (!d) return '—'
    return fmt.date(d, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Link to="/app/emis/$emiId" params={{ emiId: emi.id }} className="block">
      <Card
        variant="default"
        className="transition-colors hover:bg-surface-container-highest"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={cn(
                  'label-sm inline-flex items-center gap-1 rounded-full px-2 py-0.5 normal-case tracking-wide',
                  meta.badgeClass,
                )}
              >
                <Icon className="h-3 w-3" strokeWidth={1.75} />
                {t(`types.${meta.typeKey}`)}
              </span>
            </div>
            <h3 className="headline-sm truncate text-on-surface">
              {emi.label}
            </h3>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {fmt.currency(emi.emiAmount, currency)}
            </p>
            <p className="body-sm text-on-surface-variant">
              {t('list.perMonth')}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <ProgressBar value={emi.paidCount} max={emi.totalPayments || 1} />
          <div className="flex items-center justify-between text-xs text-on-surface-variant/75">
            <span>
              {fmt.number(emi.paidCount)} / {fmt.number(emi.totalPayments)}{' '}
              {t('list.paid')}
            </span>
            <span>{fmt.number(Math.round(progress))}%</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t('list.next')} {formatDue(emi.nextDueDate)}
          </div>
          <span className="font-medium text-on-surface-variant">
            {fmt.currency(emi.remainingBalance, currency)} {t('list.left')}
          </span>
        </div>
      </Card>
    </Link>
  )
}
