import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { TrendingUp } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { FAB } from '#/components/ui/FAB'
import { FilterPills  } from '#/components/ui/FilterPills'
import type {FilterPill} from '#/components/ui/FilterPills';
import { cn } from '#/lib/cn'
import {
  calculateReturnPercent,
  formatReturnPercent,
} from '#/lib/calculations'
import { formatCurrency  } from '#/lib/currency'
import type {Currency} from '#/lib/currency';
import { useInvestmentsQuery } from '#/hooks/useInvestments'
import type { InvestmentType } from '#/lib/validators'

type TypeFilter = InvestmentType | 'all'
type StatusFilter = 'active' | 'completed'

const TYPE_PILLS: Array<FilterPill<TypeFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'stock', label: 'Stocks' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'fd', label: 'FD' },
  { value: 'gold', label: 'Gold' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
]

const TYPE_LABELS: Record<InvestmentType, string> = {
  stock: 'Stock',
  mutual_fund: 'Mutual Fund',
  fd: 'Fixed Deposit',
  gold: 'Gold',
  crypto: 'Crypto',
  other: 'Other',
}

const TYPE_COLORS: Record<InvestmentType, string> = {
  stock: 'bg-primary-container/20 text-primary-fixed-dim',
  mutual_fund: 'bg-secondary-container/20 text-secondary',
  fd: 'bg-surface-container-highest text-on-surface-variant',
  gold: 'bg-[#a07521]/25 text-[#ffd46a]',
  crypto: 'bg-[#6a3fc7]/25 text-[#c4a8ff]',
  other: 'bg-surface-container-highest text-on-surface-variant',
}

export const Route = createFileRoute('/app/investments/')({
  component: InvestmentsListScreen,
})

function InvestmentsListScreen() {
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency as Currency

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('active')

  const { data: investments = [], isLoading } = useInvestmentsQuery({
    status,
    type: typeFilter,
  })

  const totals = investments.reduce(
    (acc, inv) => {
      acc.invested += Number(inv.investedAmount)
      acc.current += Number(
        status === 'completed' ? (inv.exitValue ?? 0) : inv.currentValue,
      )
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
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-12">
      <header className="mb-6">
        <p className="label-md text-on-surface-variant">Portfolio</p>
        <h1 className="headline-lg mt-1 text-on-surface">Investments</h1>
      </header>

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
            value={
              totals.invested > 0 ? formatReturnPercent(totalReturn) : '—'
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
        <Card variant="low" className="text-center text-on-surface-variant">
          Loading…
        </Card>
      ) : investments.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-7 w-7" strokeWidth={1.75} />}
          title={
            status === 'active' ? 'No investments yet' : 'No completed exits'
          }
          description={
            status === 'active'
              ? 'Track stocks, mutual funds, FDs, gold and crypto in one place.'
              : 'Investments you mark as completed will appear here.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {investments.map((inv) => (
            <li key={inv.id}>
              <InvestmentCard investment={inv} currency={currency} />
            </li>
          ))}
        </ul>
      )}

      <FAB to="/app/investments/new" label="Add investment" />
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

interface InvestmentCardProps {
  investment: {
    id: string
    name: string
    type: string
    investedAmount: string
    currentValue: string
    exitValue: string | null
    dateOfInvestment: Date | string
    status: string
  }
  currency: Currency
}

function InvestmentCard({ investment, currency }: InvestmentCardProps) {
  const type = investment.type as InvestmentType
  const isCompleted = investment.status === 'completed'
  const displayValue = isCompleted
    ? (investment.exitValue ?? investment.currentValue)
    : investment.currentValue
  const returnPercent = calculateReturnPercent(
    investment.investedAmount,
    displayValue,
  )
  const date = new Date(investment.dateOfInvestment)
  const formattedDate = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Link
      to="/app/investments/$id/edit"
      params={{ id: investment.id }}
      className="block"
    >
      <Card variant="default" className="transition-colors hover:bg-surface-container-highest">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="headline-sm truncate text-on-surface">
              {investment.name}
            </h3>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'label-sm inline-flex items-center rounded-full px-2 py-0.5 normal-case tracking-wide',
                  TYPE_COLORS[type],
                )}
              >
                {TYPE_LABELS[type]}
              </span>
              <span className="body-sm text-on-surface-variant/70">
                {formattedDate}
              </span>
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
            {formatCurrency(investment.investedAmount, currency)}
          </span>
        </div>
      </Card>
    </Link>
  )
}
