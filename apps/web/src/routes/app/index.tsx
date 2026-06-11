import { Suspense, lazy, useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CloudOff,
  PiggyBank,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { Skeleton } from '#/components/ui/Skeleton'
import { cn } from '#/lib/cn'
import { useFormatter } from '#/lib/i18n/useFormatter'
import { dashboardQueryOptions, useDashboardQuery } from '#/hooks/useDashboard'
import {
  collapseAllocationTail,
  getInvestmentTypeMeta,
} from '#/lib/investment-types'

const AllocationDonut = lazy(() => import('#/components/AllocationDonut'))

const ALLOCATION_TOP_N = 5

export const Route = createFileRoute('/app/')({
  staticData: { title: 'pageTitles.dashboard' },
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(dashboardQueryOptions(context.queryClient))
  },
  component: HomeScreen,
})

function HomeScreen() {
  const { t } = useTranslation('dashboard')
  const { t: tInv } = useTranslation('investments')
  const fmt = useFormatter()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const firstName = profile.fullName.split(' ')[0]

  const { data, isLoading, isError, refetch } = useDashboardQuery()
  const [selectedAllocationType, setSelectedAllocationType] = useState<
    string | null
  >(null)

  const displayedAllocation = useMemo(
    () =>
      data ? collapseAllocationTail(data.allocation, ALLOCATION_TOP_N) : [],
    [data],
  )

  if (isError && !data) {
    return (
      <main className="noir-bg min-h-dvh px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-12">
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
              {t('errors.retry')}
            </button>
          }
        />
      </main>
    )
  }

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
        <p className="label-md text-on-surface-variant">
          {t('greetingFallback')}
        </p>
        <h1 className="headline-lg mt-1 text-on-surface">
          {t('greeting', { firstName })} <span aria-hidden>👋</span>
        </h1>
      </header>

      {/* Net worth hero */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary-container to-[#1e3a8a] p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"
        />
        <p className="label-sm text-on-primary-container/80">
          {t('netWorth.label')}
        </p>
        {isLoading || !data ? (
          <Skeleton className="mt-2 h-10 w-48 bg-white/10" />
        ) : (
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-on-primary-container">
            {fmt.currency(data.netWorth, currency)}
          </p>
        )}
        <p className="body-sm mt-3 text-on-primary-container/75">
          {t('netWorth.hint')}
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
                {t('empty.title')}
              </h2>
              <p className="body-md text-on-surface-variant">
                {t('welcomeBlurb')}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <Link to="/app/investments/new" className="btn-primary">
                <TrendingUp className="h-4 w-4" strokeWidth={2} />
                {t('empty.addInvestment')}
              </Link>
              <Link
                to="/app/emis/new"
                className="block w-full rounded-xl border border-outline-variant/30 py-4 text-center font-display font-semibold text-on-surface transition hover:bg-white/5"
              >
                {t('empty.addEmi')}
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
                {t('summary.invested')}
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
                  {fmt.currency(data.investmentTotals.current, currency)}
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
                    ? fmt.percent(data.investmentTotals.gainLossPercent, {
                        showSign: true,
                      })
                    : t('summary.noHoldings')}
                </p>
              </>
            )}
          </Card>

          <Card variant="low" className="p-4">
            <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
              <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
              <span className="label-sm normal-case tracking-wide">
                {t('summary.monthlyEmi')}
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
                  {fmt.currency(data.monthlyEmiOutflow, currency)}
                </p>
                <p className="body-sm mt-0.5 text-on-surface-variant">
                  {Number(data.monthlyEmiOutflow) > 0
                    ? t('summary.totalOutflow')
                    : t('summary.noEmis')}
                </p>
              </>
            )}
          </Card>
        </section>
      )}

      {/* Investment allocation */}
      {!isEmpty && data && displayedAllocation.length > 0 && (
        <section className="mt-8">
          <h2 className="label-md mb-3 text-on-surface-variant">
            {t('allocation.title')}
          </h2>
          <Card variant="low">
            <div className="flex items-center gap-4">
              <Suspense
                fallback={<Skeleton className="h-32 w-32 rounded-full" />}
              >
                <AllocationDonut
                  data={displayedAllocation}
                  selectedType={selectedAllocationType}
                />
              </Suspense>
              <ul className="flex-1 space-y-2">
                {displayedAllocation.map((item) => {
                  const meta = getInvestmentTypeMeta(item.type)
                  const isSelected = selectedAllocationType === item.type
                  const isDimmed =
                    selectedAllocationType !== null && !isSelected
                  // Fall back to meta.label only if the i18n key is missing —
                  // covers any future investment type added before its
                  // translation lands.
                  const label = tInv(`types.${item.type}`, {
                    defaultValue: meta.label,
                  })
                  return (
                    <li key={item.type}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedAllocationType((prev) =>
                            prev === item.type ? null : item.type,
                          )
                        }
                        aria-pressed={isSelected}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md text-sm transition-opacity',
                          isDimmed && 'opacity-40',
                        )}
                      >
                        <span
                          className={cn(
                            'h-2.5 w-2.5 flex-shrink-0 rounded-full',
                            meta.swatchClass,
                          )}
                        />
                        <span className="flex-1 truncate text-left text-on-surface-variant">
                          {label}
                        </span>
                        <span className="font-display font-semibold text-on-surface">
                          {fmt.percent(item.percent)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </Card>
        </section>
      )}

      {/* Upcoming payments */}
      {!isEmpty && (
        <section className="mt-8">
          <h2 className="label-md mb-3 text-on-surface-variant">
            {t('upcoming.title')}
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
                {t('upcoming.empty')}
              </p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {data.upcomingPayments.map((p) => {
                const linkProps =
                  p.kind === 'emi'
                    ? ({
                        to: '/app/emis/$emiId',
                        params: { emiId: p.emiId },
                      } as const)
                    : ({
                        to: '/app/investments/dps/$id',
                        params: { id: p.investmentId },
                      } as const)
                const Icon = p.isOverdue
                  ? AlertTriangle
                  : p.kind === 'deposit'
                    ? PiggyBank
                    : CalendarClock
                return (
                  <li key={p.id}>
                    <Link
                      {...linkProps}
                      className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                          p.isOverdue
                            ? 'bg-tertiary-container/20 text-tertiary-fixed-dim'
                            : p.kind === 'deposit'
                              ? 'bg-secondary-container/20 text-secondary-fixed-dim'
                              : 'bg-primary-container/20 text-primary-fixed-dim',
                        )}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="headline-sm truncate text-base text-on-surface">
                          {p.label}
                        </p>
                        <p
                          className={cn(
                            'body-sm',
                            p.isOverdue
                              ? 'text-tertiary'
                              : 'text-on-surface-variant',
                          )}
                        >
                          {fmt.daysUntilDue(
                            p.isOverdue
                              ? -Math.abs(p.daysUntilDue)
                              : p.daysUntilDue,
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-base font-bold text-on-surface">
                          {fmt.currency(p.amount, currency)}
                        </p>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 text-on-surface-variant/60"
                        strokeWidth={1.75}
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  )
}
