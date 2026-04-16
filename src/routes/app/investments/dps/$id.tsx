import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Pencil, Trash2 } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { formatCurrency, getCurrencySymbol } from '#/lib/currency'
import {
  useInvestmentQuery,
  useMarkDepositPaid,
  useDeleteDps,
  useUpdateDps,
} from '#/hooks/useInvestments'

export const Route = createFileRoute('/app/investments/dps/$id')({
  staticData: { hideTabBar: true },
  component: DpsDetailScreen,
})

function DpsDetailScreen() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const { data: inv, isLoading } = useInvestmentQuery(id)
  const markDeposit = useMarkDepositPaid(id)
  const deleteDps = useDeleteDps()
  const updateDps = useUpdateDps()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  if (isLoading || !inv) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        Loading…
      </main>
    )
  }

  const deposits = inv.deposits
  const paidCount = deposits.filter((d) => d.status === 'paid').length
  const maturityValue = deposits.at(-1)?.accruedValue ?? '0.00'
  const now = new Date()

  const interestEarned =
    Number(maturityValue) -
    Number(inv.monthlyDeposit ?? 0) * (inv.tenureMonths ?? 0)

  async function handleDelete() {
    try {
      await deleteDps.mutateAsync(id)
      navigate({ to: '/app/investments' })
    } catch {
      // toast handled in hook
    }
  }

  async function handleEditSave() {
    try {
      await updateDps.mutateAsync({
        id,
        name: editName.trim() || inv?.name || '',
      })
      setEditing(false)
    } catch {
      // toast handled in hook
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-32">
      <header className="sticky top-0 z-40 flex items-center gap-4 bg-surface/80 px-5 py-4 backdrop-blur-xl">
        <Link
          to="/app/investments"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="headline-sm truncate text-on-surface">{inv.name}</h1>
          <p className="body-sm text-on-surface-variant">
            DPS · {inv.interestType === 'compound' ? 'Compound' : 'Simple'}{' '}
            interest · {inv.interestRate}% p.a.
          </p>
        </div>
        <button
          type="button"
          aria-label="Edit name"
          onClick={() => {
            setEditName(inv.name)
            setEditing(true)
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-white/5"
        >
          <Pencil className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="space-y-6 px-5 pt-4">
        {/* Hero card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a4731] to-[#0f2d1f] p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          />
          <p className="label-sm text-white/70">Total deposited</p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-white">
            {formatCurrency(inv.investedAmount, currency)}
          </p>
          <p className="body-sm mt-2 text-white/70">
            {paidCount} of {inv.tenureMonths} months paid
          </p>
          <div className="mt-4 h-1.5 rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-secondary transition-all"
              style={{
                width: `${inv.tenureMonths && inv.tenureMonths > 0 ? (paidCount / inv.tenureMonths) * 100 : 0}%`,
              }}
            />
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          <StatTile
            label="Monthly"
            value={formatCurrency(inv.monthlyDeposit ?? '0', currency)}
          />
          <StatTile
            label="Maturity value"
            value={formatCurrency(maturityValue, currency)}
            accent="secondary"
          />
          <StatTile
            label="Interest earned"
            value={formatCurrency(
              Math.max(0, interestEarned).toFixed(2),
              currency,
            )}
            accent="secondary"
          />
        </section>

        {/* Installment schedule */}
        <section className="rounded-3xl bg-surface-container-low p-4">
          <h2 className="label-md mb-3 px-2 text-on-surface-variant">
            Deposit schedule
          </h2>
          <div className="max-h-[32rem] overflow-y-auto pr-1">
            <ul className="space-y-1">
              {deposits.map((dep) => {
                const isPaid = dep.status === 'paid'
                const due = dep.dueDate ? new Date(dep.dueDate) : null
                const isOverdue = !isPaid && due !== null && due < now
                return (
                  <li key={dep.id}>
                    <button
                      type="button"
                      onClick={() =>
                        markDeposit.mutate({
                          depositId: dep.id,
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
                            #{dep.installmentNumber}
                          </span>
                          {due && (
                            <span className="body-sm">
                              {due.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="label-sm rounded-full bg-tertiary-container/30 px-2 py-0.5 text-tertiary-fixed-dim normal-case tracking-wide">
                              Overdue
                            </span>
                          )}
                        </div>
                        {dep.accruedValue && (
                          <p className="mt-0.5 text-xs text-on-surface-variant/75">
                            Balance after: {symbol}
                            {Number(dep.accruedValue).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-display text-sm font-bold',
                            isPaid && 'line-through',
                          )}
                        >
                          {formatCurrency(dep.amount, currency)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* Edit name */}
        {editing && (
          <Card variant="low">
            <p className="label-sm mb-3 text-on-surface-variant">Edit name</p>
            <TextField
              id="edit-name"
              label="Scheme name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-on-surface transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={updateDps.isPending}
                className="flex-1 rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
              >
                {updateDps.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </Card>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-tertiary opacity-70 transition hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          Delete scheme
        </button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete scheme"
        message={`Delete "${inv.name}" and all its installment rows?`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={deleteDps.isPending}
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
  accent?: 'secondary' | 'tertiary'
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <p className="label-sm normal-case tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-1 text-sm font-bold',
          accent === 'secondary'
            ? 'text-secondary'
            : accent === 'tertiary'
              ? 'text-tertiary'
              : 'text-on-surface',
        )}
      >
        {value}
      </p>
    </div>
  )
}
