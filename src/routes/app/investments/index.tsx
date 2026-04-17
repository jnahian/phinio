import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { TrendingUp } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { FilterPills } from '#/components/ui/FilterPills'
import type { FilterPill } from '#/components/ui/FilterPills'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import { calculateReturnPercent, formatReturnPercent } from '#/lib/calculations'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { useInvestmentsQuery } from '#/hooks/useInvestments'
import type { InvestmentType } from '#/lib/validators'

type TypeFilter = InvestmentType | 'dps' | 'savings' | 'all'
type StatusFilter = 'active' | 'completed'

const TYPE_PILLS: Array<FilterPill<TypeFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'stock', label: 'Stocks' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'fd', label: 'FD' },
  { value: 'gold', label: 'Gold' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'sanchayapatra', label: 'Sanchayapatra' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'agro_farm', label: 'Agro Farm' },
  { value: 'business', label: 'Business' },
  { value: 'dps', label: 'DPS' },
  { value: 'savings', label: 'Savings' },
  { value: 'other', label: 'Other' },
]

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stock',
  mutual_fund: 'Mutual Fund',
  fd: 'Fixed Deposit',
  gold: 'Gold',
  crypto: 'Crypto',
  sanchayapatra: 'Sanchayapatra',
  real_estate: 'Real Estate',
  agro_farm: 'Agro Farm',
  business: 'Business',
  dps: 'DPS',
  savings: 'Savings',
  other: 'Other',
}

const TYPE_COLORS: Record<string, string> = {
  stock: 'bg-primary-container/20 text-primary-fixed-dim',
  mutual_fund: 'bg-secondary-container/20 text-secondary',
  fd: 'bg-surface-container-highest text-on-surface-variant',
  gold: 'bg-[#a07521]/25 text-[#ffd46a]',
  crypto: 'bg-[#6a3fc7]/25 text-[#c4a8ff]',
  sanchayapatra: 'bg-[#1a3a2a]/40 text-[#6ee7a0]',
  real_estate: 'bg-[#2a1a3a]/40 text-[#c4a8ff]',
  agro_farm: 'bg-[#1a3a1a]/40 text-[#86efac]',
  business: 'bg-[#3a2a1a]/40 text-[#fbbf24]',
  dps: 'bg-[#1a4731]/40 text-[#4ade80]',
  savings: 'bg-[#1a3147]/40 text-[#60a5fa]',
  other: 'bg-surface-container-highest text-on-surface-variant',
}

export const Route = createFileRoute('/app/investments/')({
  staticData: { title: 'Investments' },
  component: InvestmentsListScreen,
})

function InvestmentsListScreen() {
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('active')

  const { data: items = [], isLoading } = useInvestmentsQuery({
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
  const totals = items.reduce(
    (acc, item) => {
      acc.invested += Number(item.investedAmount)
      acc.current +=
        status === 'completed'
          ? Number(item.exitValue ?? item.currentValue)
          : Number(item.currentValue) + Number(item.totalWithdrawn)
      return acc
    },
    { invested: 0, current: 0 },
  )

  const totalReturn =
    totals.invested > 0
      ? calculateReturnPercent(
          totals.invested.toFixed(2),
          totals.current.toFixed(2),
        )
      : 0

  return (
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-4">
      <Card variant="low" className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <SummaryCell
            label="Invested"
            value={formatCurrency(totals.invested.toFixed(2), currency)}
          />
          <SummaryCell
            label={status === 'completed' ? 'Exited' : 'Current'}
            value={formatCurrency(totals.current.toFixed(2), currency)}
          />
          <SummaryCell
            label="Return"
            value={totals.invested > 0 ? formatReturnPercent(totalReturn) : '—'}
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

      <div className="mb-4 inline-flex gap-1 rounded-full bg-surface-container-low p-1">
        <StatusTab
          active={status === 'active'}
          onClick={() => setStatus('active')}
        >
          Active
        </StatusTab>
        <StatusTab
          active={status === 'completed'}
          onClick={() => setStatus('completed')}
        >
          Completed
        </StatusTab>
      </div>

      <FilterPills
        pills={TYPE_PILLS}
        active={typeFilter}
        onChange={setTypeFilter}
        className="mb-6"
      />

      {isLoading ? (
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
          title={
            status === 'active' ? 'No investments yet' : 'No completed exits'
          }
          description={
            status === 'active'
              ? 'Track stocks, mutual funds, FDs, DPS schemes, savings pots and more.'
              : 'Investments you mark as completed will appear here.'
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
  const date = item.dateOfInvestment ? new Date(item.dateOfInvestment) : null
  const formattedDate = date
    ? date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

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
                  TYPE_COLORS[item.type] ?? TYPE_COLORS.other,
                )}
              >
                {TYPE_LABELS[item.type] ?? item.type}
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
              {formatCurrency(displayValue, currency)}
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
              {formatReturnPercent(returnPercent)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant/70">
          <span>Invested</span>
          <span className="font-medium text-on-surface-variant">
            {formatCurrency(item.investedAmount, currency)}
          </span>
        </div>
      </Card>
    </Link>
  )
}

function DpsCard({ item, currency }: ListItemProps) {
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
                  TYPE_COLORS.dps,
                )}
              >
                DPS
              </span>
              <span className="body-sm text-on-surface-variant/70">
                {item.paidCount}/{item.tenureMonths} months
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {formatCurrency(item.investedAmount, currency)}
            </p>
            {item.maturityValue && (
              <p className="body-sm font-semibold text-secondary">
                → {formatCurrency(item.maturityValue, currency)}
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
            {formatCurrency(item.monthlyDeposit ?? '0', currency)}/mo ·{' '}
            {item.interestRate}% {item.interestType}
          </span>
          {item.nextDueDate && (
            <>
              <span>·</span>
              <span>
                Next:{' '}
                {new Date(item.nextDueDate).toLocaleDateString(undefined, {
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
                  TYPE_COLORS.savings,
                )}
              >
                Savings
              </span>
              <span className="body-sm text-on-surface-variant/70">
                {item.paidCount} deposit{item.paidCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {formatCurrency(item.currentValue, currency)}
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
                {formatReturnPercent(returnPercent)}
              </p>
            )}
          </div>
        </div>
        {Number(item.investedAmount) > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant/70">
            <span>Deposited</span>
            <span className="font-medium text-on-surface-variant">
              {formatCurrency(item.investedAmount, currency)}
            </span>
          </div>
        )}
      </Card>
    </Link>
  )
}
