import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Building2, CalendarClock, CreditCard } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { FAB } from '#/components/ui/FAB'
import { FilterPills } from '#/components/ui/FilterPills'
import type { FilterPill } from '#/components/ui/FilterPills'
import { ProgressBar } from '#/components/ui/ProgressBar'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import { useEmisQuery } from '#/hooks/useEmis'
import type { EmiType } from '#/lib/validators'

type TypeFilter = EmiType | 'all'

const TYPE_PILLS: Array<FilterPill<TypeFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'bank_loan', label: 'Bank Loan' },
  { value: 'credit_card', label: 'Credit Card' },
]

const TYPE_META: Record<
  EmiType,
  { label: string; icon: typeof Building2; badgeClass: string }
> = {
  bank_loan: {
    label: 'Bank Loan',
    icon: Building2,
    badgeClass: 'bg-primary-container/20 text-primary-fixed-dim',
  },
  credit_card: {
    label: 'Credit Card',
    icon: CreditCard,
    badgeClass: 'bg-[#6a3fc7]/25 text-[#c4a8ff]',
  },
}

export const Route = createFileRoute('/app/emis/')({
  component: EmisListScreen,
})

function EmisListScreen() {
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const { data: emis = [], isLoading } = useEmisQuery({ type: typeFilter })

  const totals = emis.reduce(
    (acc, emi) => {
      acc.monthly += Number(emi.emiAmount)
      acc.remaining += Number(emi.remainingBalance)
      return acc
    },
    { monthly: 0, remaining: 0 },
  )

  return (
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-12">
      <header className="mb-6">
        <p className="label-md text-on-surface-variant">Obligations</p>
        <h1 className="headline-lg mt-1 text-on-surface">EMIs</h1>
      </header>

      <Card variant="low" className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <SummaryCell label="Active" value={String(emis.length)} />
          <SummaryCell
            label="Monthly"
            value={formatCurrency(totals.monthly.toFixed(2), currency)}
          />
          <SummaryCell
            label="Remaining"
            value={formatCurrency(totals.remaining.toFixed(2), currency)}
          />
        </div>
      </Card>

      <FilterPills
        pills={TYPE_PILLS}
        active={typeFilter}
        onChange={setTypeFilter}
        className="mb-6"
      />

      {isLoading ? (
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
        <EmptyState
          icon={<CalendarClock className="h-7 w-7" strokeWidth={1.75} />}
          title="No EMIs yet"
          description="Add bank loans or credit card EMIs to auto-generate payment schedules."
        />
      ) : (
        <ul className="space-y-3">
          {emis.map((emi) => (
            <li key={emi.id}>
              <EmiCard emi={emi} currency={currency} />
            </li>
          ))}
        </ul>
      )}

      <FAB to="/app/emis/new" label="Add EMI" />
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
  const type = emi.type as EmiType
  const meta = TYPE_META[type]
  const Icon = meta.icon
  const progress =
    emi.totalPayments > 0 ? (emi.paidCount / emi.totalPayments) * 100 : 0
  const formatDue = (d: Date | string | null): string => {
    if (!d) return '—'
    const date = new Date(d)
    return date.toLocaleDateString(undefined, {
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
                {meta.label}
              </span>
            </div>
            <h3 className="headline-sm truncate text-on-surface">
              {emi.label}
            </h3>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold text-on-surface">
              {formatCurrency(emi.emiAmount, currency)}
            </p>
            <p className="body-sm text-on-surface-variant">/ month</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <ProgressBar value={emi.paidCount} max={emi.totalPayments || 1} />
          <div className="flex items-center justify-between text-xs text-on-surface-variant/75">
            <span>
              {emi.paidCount} / {emi.totalPayments} paid
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Next {formatDue(emi.nextDueDate)}
          </div>
          <span className="font-medium text-on-surface-variant">
            {formatCurrency(emi.remainingBalance, currency)} left
          </span>
        </div>
      </Card>
    </Link>
  )
}
