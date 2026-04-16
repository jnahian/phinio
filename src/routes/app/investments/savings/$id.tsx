import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { formatCurrency, getCurrencySymbol } from '#/lib/currency'
import { calculateReturnPercent, formatReturnPercent } from '#/lib/calculations'
import {
  useInvestmentQuery,
  useUpdateSavings,
  useAddDeposit,
  useRemoveDeposit,
  useDeleteSavings,
} from '#/hooks/useInvestments'

export const Route = createFileRoute('/app/investments/savings/$id')({
  staticData: { hideTabBar: true },
  component: SavingsDetailScreen,
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function SavingsDetailScreen() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const { data: inv, isLoading } = useInvestmentQuery(id)
  const updateSavings = useUpdateSavings()
  const addDeposit = useAddDeposit(id)
  const removeDeposit = useRemoveDeposit(id)
  const deleteSavings = useDeleteSavings()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editCurrentValue, setEditCurrentValue] = useState('')

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDate, setDepositDate] = useState(todayIso())
  const [depositNotes, setDepositNotes] = useState('')

  if (isLoading || !inv) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        Loading…
      </main>
    )
  }

  const deposits = [...inv.deposits].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0
    return db - da
  })

  const returnPercent =
    Number(inv.investedAmount) > 0
      ? calculateReturnPercent(inv.investedAmount, inv.currentValue)
      : 0
  const hasReturn = Number(inv.investedAmount) > 0

  async function handleDelete() {
    try {
      await deleteSavings.mutateAsync(id)
      navigate({ to: '/app/investments' })
    } catch {
      // handled in hook
    }
  }

  function openEdit() {
    setEditName(inv?.name ?? '')
    setEditCurrentValue(inv?.currentValue ?? '0')
    setShowEditForm(true)
  }

  async function handleEditSave() {
    try {
      await updateSavings.mutateAsync({
        id,
        name: editName.trim() || inv?.name || '',
        currentValue: editCurrentValue || '0',
      })
      setShowEditForm(false)
    } catch {
      // handled in hook
    }
  }

  async function handleAddDeposit(e: React.FormEvent) {
    e.preventDefault()
    if (!depositAmount || Number(depositAmount) <= 0) return
    try {
      await addDeposit.mutateAsync({
        investmentId: id,
        amount: depositAmount,
        depositDate,
        notes: depositNotes.trim() || undefined,
      })
      setDepositAmount('')
      setDepositNotes('')
      setDepositDate(todayIso())
      setShowDepositForm(false)
    } catch {
      // handled in hook
    }
  }

  async function handleRemoveDeposit(depositId: string) {
    try {
      await removeDeposit.mutateAsync(depositId)
      setConfirmRemoveId(null)
    } catch {
      // handled in hook
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
          <p className="body-sm text-on-surface-variant">Savings pot</p>
        </div>
        <button
          type="button"
          aria-label="Edit"
          onClick={openEdit}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-white/5 text-sm font-semibold"
        >
          Edit
        </button>
      </header>

      <div className="space-y-6 px-5 pt-4">
        {/* Hero card */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3147] to-[#0f1f2d] p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          />
          <p className="label-sm text-white/70">Current balance</p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-white">
            {formatCurrency(inv.currentValue, currency)}
          </p>
          {hasReturn && (
            <p
              className={cn(
                'body-sm mt-2 font-semibold',
                returnPercent > 0
                  ? 'text-[#60a5fa]'
                  : returnPercent < 0
                    ? 'text-tertiary'
                    : 'text-white/70',
              )}
            >
              {formatReturnPercent(returnPercent)} return
            </p>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3">
          <StatTile
            label="Total deposited"
            value={formatCurrency(inv.investedAmount, currency)}
          />
          <StatTile
            label="Deposits"
            value={String(deposits.length)}
          />
        </section>

        {/* Add deposit */}
        {showDepositForm ? (
          <Card variant="low">
            <div className="mb-3 flex items-center justify-between">
              <p className="label-sm text-on-surface-variant">Add deposit</p>
              <button
                type="button"
                onClick={() => setShowDepositForm(false)}
                className="text-on-surface-variant/60 hover:text-on-surface"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={handleAddDeposit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="depositAmount"
                  label="Amount"
                  placeholder="0.00"
                  inputMode="decimal"
                  prefix={symbol}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  autoFocus
                />
                <TextField
                  id="depositDate"
                  label="Date"
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                />
              </div>
              <TextField
                id="depositNotes"
                label="Notes (optional)"
                placeholder="e.g. salary, bonus"
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
              />
              <button
                type="submit"
                disabled={addDeposit.isPending}
                className="w-full rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
              >
                {addDeposit.isPending ? 'Adding…' : 'Add deposit'}
              </button>
            </form>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setShowDepositForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant/40 py-4 text-sm font-semibold text-on-surface-variant transition hover:border-outline-variant hover:text-on-surface"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add deposit
          </button>
        )}

        {/* Deposit history */}
        {deposits.length > 0 && (
          <section className="rounded-3xl bg-surface-container-low p-4">
            <h2 className="label-md mb-3 px-2 text-on-surface-variant">
              Deposit history
            </h2>
            <ul className="space-y-1">
              {deposits.map((dep) => {
                const date = dep.dueDate ? new Date(dep.dueDate) : null
                return (
                  <li key={dep.id}>
                    <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-3">
                      <div className="min-w-0 flex-1">
                        {date && (
                          <p className="body-sm text-on-surface">
                            {date.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                        {dep.notes && (
                          <p className="mt-0.5 text-xs text-on-surface-variant/70">
                            {dep.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-bold text-on-surface">
                          +{formatCurrency(dep.amount, currency)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(dep.id)}
                          className="text-on-surface-variant/40 transition hover:text-tertiary"
                          aria-label="Remove deposit"
                        >
                          <X className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Edit form */}
        {showEditForm && (
          <Card variant="low">
            <p className="label-sm mb-3 text-on-surface-variant">Edit pot</p>
            <div className="space-y-4">
              <TextField
                id="edit-name"
                label="Name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
              <TextField
                id="edit-current-value"
                label="Current balance"
                placeholder="0.00"
                inputMode="decimal"
                prefix={symbol}
                value={editCurrentValue}
                onChange={(e) => setEditCurrentValue(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-on-surface transition hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={updateSavings.isPending}
                className="flex-1 rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
              >
                {updateSavings.isPending ? 'Saving…' : 'Save'}
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
          Delete pot
        </button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete pot"
        message={`Delete "${inv.name}" and all its deposit history?`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={deleteSavings.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmRemoveId !== null}
        title="Remove deposit"
        message="Remove this deposit entry? This can't be undone."
        confirmLabel="Remove"
        pendingLabel="Removing…"
        isPending={removeDeposit.isPending}
        onConfirm={() => confirmRemoveId && handleRemoveDeposit(confirmRemoveId)}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </main>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <p className="label-sm normal-case tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="font-display mt-1 text-sm font-bold text-on-surface">
        {value}
      </p>
    </div>
  )
}
