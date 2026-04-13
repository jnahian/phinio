import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, TrendingUp } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { formatCurrency  } from '#/lib/currency'
import type {Currency} from '#/lib/currency';

export const Route = createFileRoute('/app/')({
  component: HomeScreen,
})

function HomeScreen() {
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency as Currency
  const firstName = profile.fullName.split(' ')[0]

  return (
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-12">
      <header className="mb-6">
        <p className="label-md text-on-surface-variant">Welcome</p>
        <h1 className="headline-lg mt-1 text-on-surface">
          Hi, {firstName} <span aria-hidden>👋</span>
        </h1>
      </header>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary-container to-[#1e3a8a] p-6 shadow-[0_20px_60px_-20px_rgba(37,99,235,0.55)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        />
        <p className="label-sm text-on-primary-container/80">Net worth</p>
        <p className="font-display mt-2 text-4xl font-bold tracking-tight text-on-primary-container">
          {formatCurrency(0, currency)}
        </p>
        <p className="body-sm mt-3 text-on-primary-container/75">
          Add investments and EMIs to see your net worth.
        </p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Card variant="low" className="p-4">
          <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
            <span className="label-sm normal-case tracking-wide">
              Invested
            </span>
          </div>
          <p className="font-display text-xl font-bold text-on-surface">
            {formatCurrency(0, currency)}
          </p>
          <p className="body-sm mt-0.5 text-on-surface-variant">No holdings yet</p>
        </Card>

        <Card variant="low" className="p-4">
          <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
            <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
            <span className="label-sm normal-case tracking-wide">
              Monthly EMI
            </span>
          </div>
          <p className="font-display text-xl font-bold text-on-surface">
            {formatCurrency(0, currency)}
          </p>
          <p className="body-sm mt-0.5 text-on-surface-variant">No EMIs yet</p>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="label-md mb-3 text-on-surface-variant">
          Upcoming payments
        </h2>
        <Card variant="low" className="px-5 py-8 text-center">
          <p className="body-md text-on-surface-variant">
            Nothing due in the next 30 days.
          </p>
        </Card>
      </section>
    </main>
  )
}
