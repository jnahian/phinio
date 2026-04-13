import { createFileRoute } from '@tanstack/react-router'
import { TrendingUp } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { formatCurrency  } from '#/lib/currency'
import type {Currency} from '#/lib/currency';

export const Route = createFileRoute('/app/investments/')({
  component: InvestmentsListScreen,
})

function InvestmentsListScreen() {
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency as Currency

  return (
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-12">
      <header className="mb-6">
        <p className="label-md text-on-surface-variant">Portfolio</p>
        <h1 className="headline-lg mt-1 text-on-surface">Investments</h1>
      </header>

      <Card variant="low" className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <SummaryCell label="Invested" value={formatCurrency(0, currency)} />
          <SummaryCell label="Current" value={formatCurrency(0, currency)} />
          <SummaryCell label="Return" value="—" />
        </div>
      </Card>

      <EmptyState
        icon={<TrendingUp className="h-7 w-7" strokeWidth={1.75} />}
        title="No investments yet"
        description="Track stocks, mutual funds, FDs, gold and crypto in one place."
      />
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
