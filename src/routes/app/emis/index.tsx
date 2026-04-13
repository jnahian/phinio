import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { formatCurrency  } from '#/lib/currency'
import type {Currency} from '#/lib/currency';

export const Route = createFileRoute('/app/emis/')({
  component: EmisListScreen,
})

function EmisListScreen() {
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency as Currency

  return (
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-12">
      <header className="mb-6">
        <p className="label-md text-on-surface-variant">Obligations</p>
        <h1 className="headline-lg mt-1 text-on-surface">EMIs</h1>
      </header>

      <Card variant="low" className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <SummaryCell label="Active" value="0" />
          <SummaryCell label="Monthly" value={formatCurrency(0, currency)} />
          <SummaryCell label="Remaining" value={formatCurrency(0, currency)} />
        </div>
      </Card>

      <EmptyState
        icon={<CalendarClock className="h-7 w-7" strokeWidth={1.75} />}
        title="No EMIs yet"
        description="Add bank loans or credit card EMIs to auto-generate payment schedules."
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
