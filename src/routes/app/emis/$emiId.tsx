import { Suspense, lazy, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, Trash2 } from 'lucide-react'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { useSetTopBarTitle } from '#/lib/top-bar-context'
import { cn } from '#/lib/cn'
import { formatCurrency } from '#/lib/currency'
import { useDeleteEmi, useEmiQuery, useMarkPayment } from '#/hooks/useEmis'

const PrincipalInterestDonut = lazy(
  () => import('#/components/PrincipalInterestDonut'),
)

export const Route = createFileRoute('/app/emis/$emiId')({
  staticData: { hideTabBar: true, backTo: '/app/emis' },
  component: EmiDetailScreen,
})

function EmiDetailScreen() {
  const { emiId } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency

  const { data: emi, isLoading } = useEmiQuery(emiId)
  useSetTopBarTitle(emi?.label ?? null)
  const markPayment = useMarkPayment(emiId)
  const deleteEmi = useDeleteEmi()

  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading || !emi) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        Loading…
      </main>
    )
  }

  const payments = emi.payments
  const paidCount = payments.filter((p) => p.status === 'paid').length
  const remainingMonths = emi.tenureMonths - paidCount
  const interestPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.interestComponent), 0)
  const principalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.principalComponent), 0)
  const nextUnpaid = payments.find((p) => p.status !== 'paid')
  const remainingBalance = nextUnpaid ? Number(nextUnpaid.remainingBalance) : 0
  const totalLifetimePayment = payments.reduce(
    (sum, p) => sum + Number(p.emiAmount),
    0,
  )
  const totalInterest = Math.max(
    0,
    totalLifetimePayment - Number(emi.principal),
  )
  const now = new Date()

  async function handleDelete() {
    try {
      await deleteEmi.mutateAsync(emiId)
      navigate({ to: '/app/emis' })
    } catch {
      // Keep user on page; error surface can be improved later.
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="space-y-6 px-5 pt-4">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-container to-[#1e3a8a] p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          />
          <p className="label-sm text-on-primary-container/75">
            Remaining balance
          </p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-on-primary-container">
            {formatCurrency(remainingBalance.toFixed(2), currency)}
          </p>
          <p className="body-sm mt-2 text-on-primary-container/75">
            {remainingMonths} of {emi.tenureMonths} months left
          </p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <StatTile
            label="Monthly"
            value={formatCurrency(emi.emiAmount, currency)}
          />
          <StatTile
            label="Principal paid"
            value={formatCurrency(principalPaid.toFixed(2), currency)}
          />
          <StatTile
            label="Interest paid"
            value={formatCurrency(interestPaid.toFixed(2), currency)}
            accent="tertiary"
          />
        </section>

        <section className="rounded-3xl bg-surface-container-low p-6">
          <h2 className="label-md mb-4 text-on-surface-variant">
            Principal vs interest
          </h2>
          <Suspense
            fallback={
              <div className="h-48 animate-pulse rounded-2xl bg-surface-container-lowest" />
            }
          >
            <PrincipalInterestDonut
              principal={Number(emi.principal)}
              interest={totalInterest}
            />
          </Suspense>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <LegendPill
              color="bg-primary-container"
              label="Principal"
              value={formatCurrency(emi.principal, currency)}
            />
            <LegendPill
              color="bg-tertiary-container"
              label="Interest"
              value={formatCurrency(totalInterest.toFixed(2), currency)}
            />
          </div>
        </section>

        <section className="rounded-3xl bg-surface-container-low p-4">
          <h2 className="label-md mb-3 px-2 text-on-surface-variant">
            Amortization schedule
          </h2>
          <div className="max-h-[32rem] overflow-y-auto pr-1">
            <ul className="space-y-1">
              {payments.map((payment) => {
                const isPaid = payment.status === 'paid'
                const due = new Date(payment.dueDate)
                const isOverdue = !isPaid && due < now
                return (
                  <li key={payment.id}>
                    <button
                      type="button"
                      onClick={() =>
                        markPayment.mutate({
                          paymentId: payment.id,
                          paid: !isPaid,
                        })
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition',
                        isPaid
                          ? 'bg-transparent text-on-surface-variant/60'
                          : isOverdue
                            ? 'bg-tertiary-container/15 text-on-surface'
                            : 'hover:bg-surface-container-lowest text-on-surface',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                          isPaid
                            ? 'border-secondary bg-secondary text-on-secondary'
                            : 'border-outline-variant/50 bg-transparent',
                        )}
                      >
                        {isPaid && (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'body-sm font-semibold',
                              isPaid && 'line-through',
                            )}
                          >
                            #{payment.paymentNumber}
                          </span>
                          <span className="body-sm">
                            {due.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {isOverdue && (
                            <span className="label-sm rounded-full bg-tertiary-container/30 px-2 py-0.5 text-tertiary-fixed-dim normal-case tracking-wide">
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex gap-3 text-xs text-on-surface-variant/75">
                          <span>
                            P{' '}
                            {formatCurrency(
                              payment.principalComponent,
                              currency,
                            )}
                          </span>
                          <span>
                            I{' '}
                            {formatCurrency(
                              payment.interestComponent,
                              currency,
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-display text-sm font-bold',
                            isPaid && 'line-through',
                          )}
                        >
                          {formatCurrency(payment.emiAmount, currency)}
                        </p>
                        <p className="text-[11px] text-on-surface-variant/75">
                          bal{' '}
                          {formatCurrency(payment.remainingBalance, currency)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-tertiary opacity-70 transition hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          Delete EMI
        </button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete EMI"
        message={`Delete "${emi.label}" and all its payment rows?`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={deleteEmi.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </main>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'tertiary'
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <p className="label-sm normal-case tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-1 text-sm font-bold',
          accent === 'tertiary' ? 'text-tertiary' : 'text-on-surface',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function LegendPill({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2">
      <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', color)} />
      <div className="min-w-0 flex-1">
        <p className="label-sm normal-case tracking-wide text-on-surface-variant">
          {label}
        </p>
        <p className="font-display text-sm font-bold text-on-surface">
          {value}
        </p>
      </div>
    </div>
  )
}
