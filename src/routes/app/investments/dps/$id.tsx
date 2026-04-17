import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDownLeft, Check, Pencil, Trash2, X } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { useSetTopBarTitle } from '#/lib/top-bar-context'
import { TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { formatCurrency, getCurrencySymbol } from '#/lib/currency'
import {
  useInvestmentQuery,
  useMarkDepositPaid,
  useDeleteDps,
  useUpdateDps,
  useCloseDps,
} from '#/hooks/useInvestments'

export const Route = createFileRoute('/app/investments/dps/$id')({
  staticData: { hideTabBar: true, backTo: '/app/investments' },
  component: DpsDetailScreen,
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function DpsDetailScreen() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const { data: inv, isLoading } = useInvestmentQuery(id)
  useSetTopBarTitle(inv?.name ?? null)
  const markDeposit = useMarkDepositPaid(id)
  const deleteDps = useDeleteDps()
  const updateDps = useUpdateDps()
  const closeDps = useCloseDps(id)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  // Premature closure modal state
  const [showClose, setShowClose] = useState(false)
  const [cReceived, setCReceived] = useState('')
  const [cDate, setCDate] = useState(todayIso())
  const [cNotes, setCNotes] = useState('')
  const [cError, setCError] = useState<string | null>(null)

  if (isLoading || !inv) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        Loading…
      </main>
    )
  }

  const deposits = inv.deposits
  const paidCount = deposits.filter((d) => d.status === 'paid').length
  const upcomingCount = deposits.filter((d) => d.status !== 'paid').length
  const maturityValue = deposits.at(-1)?.accruedValue ?? '0.00'
  const paidSorted = [...deposits]
    .filter((d) => d.status === 'paid')
    .sort((a, b) => (b.installmentNumber ?? 0) - (a.installmentNumber ?? 0))
  const accruedNow =
    (paidSorted.length > 0 ? paidSorted[0].accruedValue : null) ??
    inv.investedAmount
  const isClosed = inv.status === 'closed'
  const isMatured = inv.status === 'matured'
  const isActive = inv.status === 'active'
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

  function openClose() {
    setCReceived(String(accruedNow))
    setCDate(todayIso())
    setCNotes('')
    setCError(null)
    setShowClose(true)
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault()
    setCError(null)
    if (!cReceived || Number(cReceived) <= 0) {
      setCError('Enter the amount received')
      return
    }
    try {
      await closeDps.mutateAsync({
        investmentId: id,
        receivedAmount: cReceived,
        closureDate: cDate,
        notes: cNotes.trim() || undefined,
      })
      setShowClose(false)
    } catch {
      // toast handled in hook
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-32">
      <div className="space-y-6 px-5 pt-4">
        <div className="flex items-center justify-between">
          <p className="body-sm text-on-surface-variant">
            DPS · {inv.interestType === 'compound' ? 'Compound' : 'Simple'}{' '}
            interest · {inv.interestRate}% p.a.
          </p>
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
        </div>
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

        {/* Closure banner */}
        {(isClosed || isMatured) && inv.exitValue && inv.completedAt && (
          <section
            className={cn(
              'rounded-3xl p-5',
              isClosed
                ? 'bg-tertiary-container/15 text-on-surface'
                : 'bg-secondary-container/15 text-on-surface',
            )}
          >
            <p className="label-sm text-on-surface-variant">
              {isClosed ? 'Closed prematurely' : 'Matured'}
            </p>
            <p className="font-display mt-1 text-lg font-bold">
              Received {formatCurrency(inv.exitValue, currency)} on{' '}
              {new Date(inv.completedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </section>
        )}

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
                            {Number(dep.accruedValue).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
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

        {/* Close prematurely */}
        {isActive && (
          <button
            type="button"
            onClick={openClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant/40 py-4 text-sm font-semibold text-on-surface-variant transition hover:border-outline-variant hover:text-on-surface"
          >
            <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
            Close prematurely
          </button>
        )}

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

      {showClose && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setShowClose(false)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card
              variant="low"
              className="rounded-t-3xl rounded-b-none sm:rounded-3xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="label-sm text-on-surface-variant">
                  Close DPS prematurely
                </p>
                <button
                  type="button"
                  onClick={() => setShowClose(false)}
                  className="text-on-surface-variant/60 hover:text-on-surface"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              <p className="body-sm mb-4 text-on-surface-variant">
                Accrued so far: {formatCurrency(accruedNow, currency)}. Banks
                often deduct a penalty — enter the amount you actually receive.{' '}
                {upcomingCount} upcoming installment
                {upcomingCount !== 1 ? 's' : ''} will be cancelled.
              </p>
              <form onSubmit={handleClose} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    id="cReceived"
                    label="Amount received"
                    placeholder="0.00"
                    inputMode="decimal"
                    prefix={symbol}
                    value={cReceived}
                    onChange={(e) => setCReceived(e.target.value)}
                    autoFocus
                    error={cError ?? undefined}
                  />
                  <TextField
                    id="cDate"
                    label="Closure date"
                    type="date"
                    value={cDate}
                    onChange={(e) => setCDate(e.target.value)}
                  />
                </div>
                <TextField
                  id="cNotes"
                  label="Notes (optional)"
                  placeholder="e.g. emergency, switched bank"
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                />
                <p className="text-xs text-tertiary">This cannot be undone.</p>
                <button
                  type="submit"
                  disabled={closeDps.isPending}
                  className="w-full rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
                >
                  {closeDps.isPending ? 'Closing…' : 'Confirm closure'}
                </button>
              </form>
            </Card>
          </div>
        </div>
      )}
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
