import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, CloudOff, TrendingUp } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { WithdrawModal } from '#/components/WithdrawModal'
import { EmptyState } from '#/components/ui/EmptyState'
import { FilterPills } from '#/components/ui/FilterPills'
import type { FilterPill } from '#/components/ui/FilterPills'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import { calculateReturnPercent } from '#/lib/calculations'
import type { Currency } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'
import {
  investmentsListQueryOptions,
  useInvestmentsQuery,
} from '#/hooks/useInvestments'
import type { InvestmentType } from '#/lib/validators'
import { INVESTMENT_TYPE_META } from '#/lib/investment-types'

type TypeFilter = InvestmentType | 'dps' | 'savings' | 'all'
type StatusFilter = 'active' | 'completed'

const TYPE_PILL_KEYS: ReadonlyArray<TypeFilter> = [
  'all',
  'stock',
  'mutual_fund',
  'fd',
  'gold',
  'crypto',
  'sanchayapatra',
  'real_estate',
  'agro_farm',
  'business',
  'dps',
  'savings',
  'other',
]

export const Route = createFileRoute('/app/investments/')({
  staticData: { title: 'pageTitles.investments' },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(
      investmentsListQueryOptions({ status: 'active', type: 'all' }),
    )
  },
  component: InvestmentsListScreen,
})

function InvestmentsListScreen() {
  const { t } = useTranslation('investments')
  const { t: tCommon } = useTranslation('common')
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const fmt = useFormatter()

  const TYPE_PILLS: Array<FilterPill<TypeFilter>> = useMemo(
    () =>
      TYPE_PILL_KEYS.map((k) => ({
        value: k,
        label: t(`types.${k}`),
      })),
    [t],
  )

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [showWithdraw, setShowWithdraw] = useState(false)

  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useInvestmentsQuery({
    status,
    type: typeFilter,
  })

  const totalItems = items.length

  // ROI numerator semantics:
  //   active    → currentValue + totalWithdrawn  (withdrawals reduced
  //               currentValue, so add them back to recover realized + held)
  //   completed → exitValue alone  (the realized total at close — for
  //               withdrawal-closure exitValue already equals totalWithdrawn,
  //               so adding it again would double-count)
  // Accumulate in integer cents to avoid float drift across many money strings
  // (CLAUDE.md rule). Convert back to a fixed-2 string at the boundary.
  const totals = items.reduce(
    (acc, item) => {
      acc.invested += Math.round(Number(item.investedAmount) * 100)
      acc.current +=
        status === 'completed'
          ? Math.round(Number(item.exitValue ?? item.currentValue) * 100)
          : Math.round(Number(item.currentValue) * 100) +
            Math.round(Number(item.totalWithdrawn) * 100)
      return acc
    },
    { invested: 0, current: 0 },
  )

  const investedStr = (totals.invested / 100).toFixed(2)
  const currentStr = (totals.current / 100).toFixed(2)
  const totalReturn =
    totals.invested > 0 ? calculateReturnPercent(investedStr, currentStr) : 0

  return (
    <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
      <Card variant="low" className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <SummaryCell
            label={t('list.totalInvested')}
            value={fmt.currency(investedStr, currency)}
          />
          <SummaryCell
            label={
              status === 'completed'
                ? t('list.totalExited')
                : t('list.totalCurrent')
            }
            value={fmt.currency(currentStr, currency)}
          />
          <SummaryCell
            label={t('list.return')}
            value={
              totals.invested > 0
                ? fmt.percent(totalReturn, { showSign: true })
                : '—'
            }
            valueClass={
              totalReturn > 0
                ? 'text-secondary'
                : totalReturn < 0
                  ? 'text-tertiary'
                  : 'text-on-surface'
            }
          />
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-full bg-surface-container-low p-1">
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
        <button
          type="button"
          onClick={() => setShowWithdraw(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
        >
          <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {t('list.withdraw')}
        </button>
      </div>

      <FilterPills
        pills={TYPE_PILLS}
        active={typeFilter}
        onChange={setTypeFilter}
        className="mb-6"
      />

      {isError && totalItems === 0 ? (
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
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card variant="default">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="ml-auto h-5 w-24" />
                    <Skeleton className="ml-auto h-3 w-16" />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : totalItems === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-7 w-7" strokeWidth={1.75} />}
          title={status === 'active' ? t('list.empty') : t('list.noExits')}
          description={
            status === 'active' ? t('list.emptyHint') : t('list.noExitsHint')
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            if (item.mode === 'scheduled') {
              return (
                <li key={item.id}>
                  <DpsCard item={item} currency={currency} />
                </li>
              )
            }
            if (item.mode === 'flexible') {
              return (
                <li key={item.id}>
                  <SavingsCard item={item} currency={currency} />
                </li>
              )
            }
            return (
              <li key={item.id}>
                <InvestmentCard item={item} currency={currency} />
              </li>
            )
          })}
        </ul>
      )}

      <WithdrawModal
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        currency={currency}
      />
    </main>
  )
}

function SummaryCell({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <p className="label-sm normal-case tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-1 text-base font-bold',
          valueClass ?? 'text-on-surface',
        )}
      >
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

interface ListItemProps {
  item: {
    id: string
    name: string
    type: string
    mode: string
    status: string
    investedAmount: string
    currentValue: string
    exitValue: string | null
    totalWithdrawn: string
    dateOfInvestment: Date | string | null
    estimatedClosureDate: Date | string | null
    monthlyDeposit: string | null
    tenureMonths: number | null
    interestRate: string | null
    interestType: string | null
    startDate: Date | string | null
    paidCount: number
    maturityValue: string | null
    nextDueDate: Date | string | null
  }
  currency: Currency
}

function InvestmentCard({ item, currency }: ListItemProps) {
  const { t } = useTranslation('investments')
  const fmt = useFormatter()
  const isCompleted = item.status === 'completed'
  const displayValue = isCompleted
    ? (item.exitValue ?? item.currentValue)
    : item.currentValue
  // For completed items, exitValue is the full realized total (and equals
  // totalWithdrawn for closures driven by withdrawal). Only add
  // totalWithdrawn back for active items where currentValue was decremented.
  const returnNumerator = isCompleted
    ? displayValue
    : (Number(displayValue) + Number(item.totalWithdrawn)).toFixed(2)
  const returnPercent = calculateReturnPercent(
    item.investedAmount,
    returnNumerator,
  )
  const formattedDate = item.dateOfInvestment
    ? fmt.date(item.dateOfInvestment, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const formattedClosureDate =
    !isCompleted && item.estimatedClosureDate
      ? fmt.date(item.estimatedClosureDate, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null
  const typeKey = (
    item.type in INVESTMENT_TYPE_META ? item.type : 'other'
  ) as keyof typeof INVESTMENT_TYPE_META
  const meta = INVESTMENT_TYPE_META[typeKey]

  return (
    <Link
      to="/app/investments/$id/edit"
      params={{ id: item.id }}
      className="block"
    >
      <Card
        variant="default"
        className="transition-colors hover:bg-surface-container-highest"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="headline-sm truncate text-on-surface">
              {item.name}
            </h3>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'label-sm inline-flex items-center rounded-full px-2 py-0.5 normal-case tracking-wide',
                  meta.chipClass,
                )}
              >
                {t(`types.${typeKey}`)}
              </span>
              {formattedDate && (
                <span className="body-sm text-on-surface-variant/70">
                  {formattedDate}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {fmt.currency(displayValue, currency)}
            </p>
            <p
              className={cn(
                'body-sm font-semibold',
                returnPercent > 0
                  ? 'text-secondary'
                  : returnPercent < 0
                    ? 'text-tertiary'
                    : 'text-on-surface-variant',
              )}
            >
              {fmt.percent(returnPercent, { showSign: true })}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant/70">
          <span>{t('list.totalInvested')}</span>
          <span className="font-medium text-on-surface-variant">
            {fmt.currency(item.investedAmount, currency)}
          </span>
          {formattedClosureDate && (
            <>
              <span>·</span>
              <span>
                {t('list.estimatedClosure')}:{' '}
                <span className="font-medium text-on-surface-variant">
                  {formattedClosureDate}
                </span>
              </span>
            </>
          )}
        </div>
      </Card>
    </Link>
  )
}

function DpsCard({ item, currency }: ListItemProps) {
  const { t } = useTranslation('investments')
  const { t: tCommon } = useTranslation('common')
  const fmt = useFormatter()
  const progressPercent =
    item.tenureMonths && item.tenureMonths > 0
      ? (item.paidCount / item.tenureMonths) * 100
      : 0

  return (
    <Link
      to="/app/investments/dps/$id"
      params={{ id: item.id }}
      className="block"
    >
      <Card
        variant="default"
        className="transition-colors hover:bg-surface-container-highest"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="headline-sm truncate text-on-surface">
              {item.name}
            </h3>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'label-sm inline-flex items-center rounded-full px-2 py-0.5 normal-case tracking-wide',
                  INVESTMENT_TYPE_META.dps.chipClass,
                )}
              >
                {t('types.dps')}
              </span>
              <span className="body-sm text-on-surface-variant/70">
                {fmt.number(item.paidCount)}/
                {fmt.number(item.tenureMonths ?? 0)} {tCommon('units.months')}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {fmt.currency(item.investedAmount, currency)}
            </p>
            {item.maturityValue && (
              <p className="body-sm font-semibold text-secondary">
                → {fmt.currency(item.maturityValue, currency)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 h-1 rounded-full bg-surface-container-highest">
          <div
            className="h-1 rounded-full bg-secondary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant/70">
          <span>
            {fmt.currency(item.monthlyDeposit ?? '0', currency)}
            {t('list.perMonth')} · {fmt.number(Number(item.interestRate ?? 0))}%{' '}
            {item.interestType === 'compound'
              ? t('dps.interestCompound')
              : t('dps.interestSimple')}
          </span>
          {item.nextDueDate && (
            <>
              <span>·</span>
              <span>
                {t('list.next')}:{' '}
                {fmt.date(item.nextDueDate, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </>
          )}
        </div>
      </Card>
    </Link>
  )
}

function SavingsCard({ item, currency }: ListItemProps) {
  const { t } = useTranslation('investments')
  const fmt = useFormatter()
  const returnNumerator = (
    Number(item.currentValue) + Number(item.totalWithdrawn)
  ).toFixed(2)
  const returnPercent = calculateReturnPercent(
    item.investedAmount,
    returnNumerator,
  )
  const hasReturn = Number(item.investedAmount) > 0

  return (
    <Link
      to="/app/investments/savings/$id"
      params={{ id: item.id }}
      className="block"
    >
      <Card
        variant="default"
        className="transition-colors hover:bg-surface-container-highest"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="headline-sm truncate text-on-surface">
              {item.name}
            </h3>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'label-sm inline-flex items-center rounded-full px-2 py-0.5 normal-case tracking-wide',
                  INVESTMENT_TYPE_META.savings.chipClass,
                )}
              >
                {t('types.savings')}
              </span>
              <span className="body-sm text-on-surface-variant/70">
                {t('list.deposits', { count: item.paidCount })}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {fmt.currency(item.currentValue, currency)}
            </p>
            {hasReturn && (
              <p
                className={cn(
                  'body-sm font-semibold',
                  returnPercent > 0
                    ? 'text-secondary'
                    : returnPercent < 0
                      ? 'text-tertiary'
                      : 'text-on-surface-variant',
                )}
              >
                {fmt.percent(returnPercent, { showSign: true })}
              </p>
            )}
          </div>
        </div>
        {Number(item.investedAmount) > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant/70">
            <span>{t('list.deposited')}</span>
            <span className="font-medium text-on-surface-variant">
              {fmt.currency(item.investedAmount, currency)}
            </span>
          </div>
        )}
      </Card>
    </Link>
  )
}
