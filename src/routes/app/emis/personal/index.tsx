import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CloudOff,
  HandCoins,
} from 'lucide-react'
import { LoansSegment } from '#/components/LoansSegment'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { FilterPills } from '#/components/ui/FilterPills'
import type { FilterPill } from '#/components/ui/FilterPills'
import { ProgressBar } from '#/components/ui/ProgressBar'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import type { Currency } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'
import type { LoanDirection } from '#/lib/validators'
import {
  personalLoansListQueryOptions,
  usePersonalLoansQuery,
} from '#/hooks/usePersonalLoans'

type DirectionFilter = LoanDirection | 'all'
type StatusFilter = 'active' | 'settled'

const DIRECTION_META: Record<
  LoanDirection,
  { icon: typeof ArrowDownLeft; badgeClass: string }
> = {
  borrowed: {
    icon: ArrowDownLeft,
    badgeClass: 'bg-tertiary/15 text-tertiary',
  },
  lent: {
    icon: ArrowUpRight,
    badgeClass: 'bg-primary-container/20 text-primary-fixed-dim',
  },
}

export const Route = createFileRoute('/app/emis/personal/')({
  staticData: { title: 'pageTitles.emis' },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      personalLoansListQueryOptions({ status: 'active' }),
    )
  },
  component: PersonalLoansListScreen,
})

function PersonalLoansListScreen() {
  const { t } = useTranslation('emis')
  const { t: tCommon } = useTranslation('common')
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const fmt = useFormatter()

  const DIRECTION_PILLS: Array<FilterPill<DirectionFilter>> = [
    { value: 'all', label: t('personal.directions.all') },
    { value: 'borrowed', label: t('personal.directions.borrowed') },
    { value: 'lent', label: t('personal.directions.lent') },
  ]

  const [direction, setDirection] = useState<DirectionFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const {
    data: loans = [],
    isLoading,
    isError,
    refetch,
  } = usePersonalLoansQuery({ status })

  const visible =
    direction === 'all' ? loans : loans.filter((l) => l.direction === direction)

  // Integer cents so summing many money strings doesn't drift.
  const totals = loans.reduce(
    (acc, loan) => {
      const cents = Math.round(Number(loan.outstanding) * 100)
      if (loan.direction === 'lent') acc.owedToYou += cents
      else acc.owed += cents
      return acc
    },
    { owed: 0, owedToYou: 0 },
  )

  return (
    <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
      <LoansSegment active="personal" />

      {status === 'active' && (
        <Card variant="low" className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <SummaryCell
              label={t('personal.list.youOwe')}
              value={fmt.currency((totals.owed / 100).toFixed(2), currency)}
            />
            <SummaryCell
              label={t('personal.list.owedToYou')}
              value={fmt.currency(
                (totals.owedToYou / 100).toFixed(2),
                currency,
              )}
            />
          </div>
        </Card>
      )}

      <div className="mb-4 inline-flex gap-1 rounded-full bg-surface-container-low p-1">
        <StatusTab
          active={status === 'active'}
          onClick={() => setStatus('active')}
        >
          {t('personal.list.active')}
        </StatusTab>
        <StatusTab
          active={status === 'settled'}
          onClick={() => setStatus('settled')}
        >
          {t('personal.list.settled')}
        </StatusTab>
      </div>

      <FilterPills
        pills={DIRECTION_PILLS}
        active={direction}
        onChange={setDirection}
        className="mb-6"
      />

      {isError && loans.length === 0 ? (
        <EmptyState
          icon={<CloudOff className="h-7 w-7" strokeWidth={1.75} />}
          title={t('personal.list.loadFailed')}
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
              </Card>
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        status === 'settled' ? (
          <EmptyState
            icon={<CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />}
            title={t('personal.list.noSettled')}
            description={t('personal.list.noSettledHint')}
          />
        ) : (
          <EmptyState
            icon={<HandCoins className="h-7 w-7" strokeWidth={1.75} />}
            title={t('personal.list.empty')}
            description={t('personal.list.emptyHint')}
            action={
              <Link to="/app/emis/personal/new" className="btn-primary">
                {t('personal.form.submit')}
              </Link>
            }
          />
        )
      ) : (
        <ul className="space-y-3">
          {visible.map((loan) => (
            <li key={loan.id}>
              <LoanCard loan={loan} currency={currency} />
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

interface LoanCardProps {
  loan: {
    id: string
    direction: LoanDirection
    counterparty: string
    totalDue: string
    repaid: string
    outstanding: string
  }
  currency: Currency
}

function LoanCard({ loan, currency }: LoanCardProps) {
  const { t } = useTranslation('emis')
  const fmt = useFormatter()
  const meta = DIRECTION_META[loan.direction]
  const Icon = meta.icon
  const total = Number(loan.totalDue)
  const repaid = Number(loan.repaid)
  const progress = total > 0 ? (repaid / total) * 100 : 0

  return (
    <Link
      to="/app/emis/personal/$loanId"
      params={{ loanId: loan.id }}
      className="block"
    >
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
                {t(`personal.directions.${loan.direction}`)}
              </span>
            </div>
            <h3 className="headline-sm truncate text-on-surface">
              {loan.counterparty}
            </h3>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {fmt.currency(loan.outstanding, currency)}
            </p>
            <p className="body-sm text-on-surface-variant">
              {t('personal.list.left')}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <ProgressBar value={repaid} max={total || 1} />
          <div className="flex items-center justify-between text-xs text-on-surface-variant/75">
            <span>
              {t('personal.list.paidOf', {
                paid: fmt.currency(loan.repaid, currency),
                total: fmt.currency(loan.totalDue, currency),
              })}
            </span>
            <span>{fmt.number(Math.round(progress))}%</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
