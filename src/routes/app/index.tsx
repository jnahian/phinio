import { Suspense, lazy } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import { formatReturnPercent } from '#/lib/calculations'
import { formatCurrency } from '#/lib/currency'
import { useDashboardQuery } from '#/hooks/useDashboard'

const AllocationDonut = lazy(() => import('#/components/AllocationDonut'))

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stocks',
  mutual_fund: 'Mutual Funds',
  fd: 'Fixed Deposit',
  gold: 'Gold',
  crypto: 'Crypto',
  sanchayapatra: 'Sanchayapatra',
  real_estate: 'Real Estate',
  agro_farm: 'Agro Farm',
  business: 'Business',
  other: 'Other',
}

const TYPE_COLORS: Record<string, string> = {
  stock: 'bg-primary-container',
  mutual_fund: 'bg-secondary',
  fd: 'bg-outline-variant',
  gold: 'bg-[#ffd46a]',
  crypto: 'bg-[#c4a8ff]',
  sanchayapatra: 'bg-[#6ee7a0]',
  real_estate: 'bg-[#c4a8ff]',
  agro_farm: 'bg-[#86efac]',
  business: 'bg-[#fbbf24]',
  other: 'bg-outline-variant/60',
}

export const Route = createFileRoute('/app/')({
  staticData: { title: 'Dashboard' },
  component: HomeScreen,
})

function HomeScreen() {
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const firstName = profile.fullName.split(' ')[0]

  const { data, isLoading } = useDashboardQuery()

  // Fresh accounts with no investments and no EMIs get a single welcome CTA
  // instead of three stacked empty sections.
  const isEmpty = data
    ? Number(data.investmentTotals.invested) === 0 &&
      Number(data.monthlyEmiOutflow) === 0 &&
      data.upcomingPayments.length === 0 &&
      data.allocation.length === 0
    : false

  return (
    <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-12">
      <header className="mb-6">
        <p className="label-md text-on-surface-variant">Welcome</p>
        <h1 className="headline-lg mt-1 text-on-surface">
          Hi, {firstName} <span aria-hidden>👋</span>
        </h1>
      </header>

      {/* Net worth hero */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary-container to-[#1e3a8a] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        />
        <p className="label-sm text-on-primary-container/80">Net worth</p>
        {isLoading || !data ? (
          <Skeleton className="mt-2 h-10 w-48 bg-white/10" />
        ) : (
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-on-primary-container">
            {formatCurrency(data.netWorth, currency)}
          </p>
        )}
        <p className="body-sm mt-3 text-on-primary-container/75">
          Assets minus remaining EMI balance.
        </p>
      </section>

      {isEmpty && (
        <section className="mt-6">
          <Card variant="low" className="space-y-5 p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container/20 text-primary-fixed-dim">
              <Sparkles className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <div className="space-y-2">
              <h2 className="headline-sm text-on-surface">
                Start tracking your finances
              </h2>
              <p className="body-md text-on-surface-variant">
                Add your first investment or EMI to see everything come to life
                — net worth, returns, and upcoming payments in one place.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <Link to="/app/investments/new" className="btn-primary">
                <TrendingUp className="h-4 w-4" strokeWidth={2} />
                Add an investment
              </Link>
              <Link
                to="/app/emis/new"
                className="block w-full rounded-xl border border-outline-variant/30 py-4 text-center font-display font-semibold text-on-surface transition hover:bg-white/5"
              >
                Add an EMI
              </Link>
            </div>
          </Card>
        </section>
      )}

      {/* Quick stats row */}
      {!isEmpty && (
        <section className="mt-4 grid grid-cols-2 gap-3">
          <Card variant="low" className="p-4">
            <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
              <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
              <span className="label-sm normal-case tracking-wide">
                Invested
              </span>
            </div>
            {isLoading || !data ? (
              <>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </>
            ) : (
              <>
                <p className="font-display text-xl font-bold text-on-surface">
                  {formatCurrency(data.investmentTotals.current, currency)}
                </p>
                <p
                  className={cn(
                    'body-sm mt-0.5 font-semibold',
                    data.investmentTotals.gainLossPercent > 0
                      ? 'text-secondary'
                      : data.investmentTotals.gainLossPercent < 0
                        ? 'text-tertiary'
                        : 'text-on-surface-variant',
                  )}
                >
                  {Number(data.investmentTotals.invested) > 0
                    ? formatReturnPercent(data.investmentTotals.gainLossPercent)
                    : 'No holdings'}
                </p>
              </>
            )}
          </Card>

          <Card variant="low" className="p-4">
            <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
              <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
              <span className="label-sm normal-case tracking-wide">
                Monthly EMI
              </span>
            </div>
            {isLoading || !data ? (
              <>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="mt-1 h-3 w-16" />
              </>
            ) : (
              <>
                <p className="font-display text-xl font-bold text-on-surface">
                  {formatCurrency(data.monthlyEmiOutflow, currency)}
                </p>
                <p className="body-sm mt-0.5 text-on-surface-variant">
                  {Number(data.monthlyEmiOutflow) > 0
                    ? 'Total outflow'
                    : 'No EMIs yet'}
                </p>
              </>
            )}
          </Card>
        </section>
      )}

      {/* Upcoming payments */}
      {!isEmpty && (
        <section className="mt-8">
          <h2 className="label-md mb-3 text-on-surface-variant">
            Upcoming payments
          </h2>
          {isLoading || !data ? (
            <Card variant="low" className="space-y-3 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ) : data.upcomingPayments.length === 0 ? (
            <Card variant="low" className="px-5 py-8 text-center">
              <p className="body-md text-on-surface-variant">
                Nothing due in the next 30 days.
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {data.upcomingPayments.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/app/emis/$emiId"
                    params={{ emiId: p.emiId }}
                    className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                        p.isOverdue
                          ? 'bg-tertiary-container/20 text-tertiary-fixed-dim'
                          : 'bg-primary-container/20 text-primary-fixed-dim',
                      )}
                    >
                      {p.isOverdue ? (
                        <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
                      ) : (
                        <CalendarClock className="h-5 w-5" strokeWidth={1.75} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="headline-sm truncate text-base text-on-surface">
                        {p.emiLabel}
                      </p>
                      <p
                        className={cn(
                          'body-sm',
                          p.isOverdue
                            ? 'text-tertiary'
                            : 'text-on-surface-variant',
                        )}
                      >
                        {formatRelativeDue(p.daysUntilDue, p.isOverdue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-base font-bold text-on-surface">
                        {formatCurrency(p.emiAmount, currency)}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-4 w-4 text-on-surface-variant/60"
                      strokeWidth={1.75}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Investment allocation */}
      {!isEmpty && data && data.allocation.length > 0 && (
        <section className="mt-8">
          <h2 className="label-md mb-3 text-on-surface-variant">Allocation</h2>
          <Card variant="low">
            <div className="flex items-center gap-4">
              <Suspense
                fallback={<Skeleton className="h-32 w-32 rounded-full" />}
              >
                <AllocationDonut data={data.allocation} />
              </Suspense>
              <ul className="flex-1 space-y-2">
                {data.allocation.slice(0, 5).map((item) => (
                  <li
                    key={item.type}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 flex-shrink-0 rounded-full',
                        TYPE_COLORS[item.type] ?? TYPE_COLORS.other,
                      )}
                    />
                    <span className="flex-1 truncate text-on-surface-variant">
                      {TYPE_LABELS[item.type] ?? 'Other'}
                    </span>
                    <span className="font-display font-semibold text-on-surface">
                      {item.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </section>
      )}
    </main>
  )
}

function formatRelativeDue(days: number, isOverdue: boolean): string {
  if (isOverdue) {
    const abs = Math.abs(days)
    return abs === 0
      ? 'Overdue — due today'
      : `Overdue by ${abs} day${abs === 1 ? '' : 's'}`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}
