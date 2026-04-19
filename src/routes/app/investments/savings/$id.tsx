import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDownLeft, Plus, Trash2, X } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { WithdrawModal } from '#/components/WithdrawModal'
import { useSetTopBarTitle } from '#/lib/top-bar-context'
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
  staticData: { hideTabBar: true, backTo: '/app/investments' },
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
  useSetTopBarTitle(inv?.name ?? null)
  const updateSavings = useUpdateSavings()
  const addDeposit = useAddDeposit(id)
  const removeDeposit = useRemoveDeposit(id)
  const deleteSavings = useDeleteSavings()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
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

  type ActivityRow =
    | {
        kind: 'deposit'
        id: string
        date: number
        amount: string
        notes: string | null
      }
    | {
        kind: 'withdrawal'
        id: string
        date: number
        amount: string
        notes: string | null
      }

  const activity: Array<ActivityRow> = [
    ...inv.deposits.map(
      (d): ActivityRow => ({
        kind: 'deposit',
        id: d.id,
        date: d.dueDate ? new Date(d.dueDate).getTime() : 0,
        amount: d.amount,
        notes: d.notes,
      }),
    ),
    ...inv.withdrawals.map(
      (w): ActivityRow => ({
        kind: 'withdrawal',
        id: w.id,
        date: new Date(w.withdrawalDate).getTime(),
        amount: w.amount,
        notes: w.notes,
      }),
    ),
  ].sort((a, b) => b.date - a.date)

  const isActive = inv.status === 'active'

  const totalWithdrawn = inv.withdrawals.reduce(
    (sum, w) => sum + Number(w.amount),
    0,
  )
  const returnNumerator = (Number(inv.currentValue) + totalWithdrawn).toFixed(2)
  const returnPercent =
    Number(inv.investedAmount) > 0
      ? calculateReturnPercent(inv.investedAmount, returnNumerator)
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
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="space-y-6 px-5 pt-4">
        <div className="flex items-center justify-between">
          <p className="body-sm text-on-surface-variant">Savings pot</p>
          <button
            type="button"
            aria-label="Edit"
            onClick={openEdit}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-on-surface-variant hover:bg-white/5"
          >
            Edit
          </button>
        </div>
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
          {isActive && !showDepositForm && (
            <div className="relative mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowDepositForm(true)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Deposit
              </button>
              <button
                type="button"
                onClick={() => setShowWithdraw(true)}
                disabled={Number(inv.currentValue) <= 0}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-white/10"
              >
                <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                Withdraw
              </button>
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3">
          <StatTile
            label="Total deposited"
            value={formatCurrency(inv.investedAmount, currency)}
          />
          <StatTile label="Deposits" value={String(deposits.length)} />
        </section>

        {/* Add deposit */}
        {showDepositForm && (
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
        )}

        {/* Activity history (deposits + withdrawals) */}
        {activity.length > 0 && (
          <section className="rounded-3xl bg-surface-container-low p-4">
            <h2 className="label-md mb-3 px-2 text-on-surface-variant">
              Activity
            </h2>
            <ul className="space-y-1">
              {activity.map((row) => {
                const date = row.date > 0 ? new Date(row.date) : null
                const isDeposit = row.kind === 'deposit'
                return (
                  <li key={`${row.kind}:${row.id}`}>
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
                        {row.notes && (
                          <p className="mt-0.5 text-xs text-on-surface-variant/70">
                            {row.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            'font-display text-sm font-bold',
                            isDeposit ? 'text-on-surface' : 'text-tertiary',
                          )}
                        >
                          {isDeposit ? '+' : '−'}
                          {formatCurrency(row.amount, currency)}
                        </p>
                        {isDeposit && (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(row.id)}
                            className="text-on-surface-variant/40 transition hover:text-tertiary"
                            aria-label="Remove deposit"
                          >
                            <X className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        )}
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
        onConfirm={() =>
          confirmRemoveId && handleRemoveDeposit(confirmRemoveId)
        }
        onCancel={() => setConfirmRemoveId(null)}
      />

      <WithdrawModal
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        currency={currency}
        preselectedInvestmentId={id}
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
