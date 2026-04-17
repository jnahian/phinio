import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowDownLeft,
  Bitcoin,
  Briefcase,
  Building,
  Circle,
  Coins,
  LineChart,
  Package,
  PieChart,
  Shield,
  Sprout,
  Trash2,
  X,
} from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { TextArea, TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { formatCurrency, getCurrencySymbol } from '#/lib/currency'
import {
  useDeleteInvestment,
  useInvestmentQuery,
  useUpdateInvestment,
  useWithdraw,
} from '#/hooks/useInvestments'
import { investmentUpdateSchema } from '#/lib/validators'
import type { InvestmentType } from '#/lib/validators'

export const Route = createFileRoute('/app/investments/$id/edit')({
  staticData: {
    hideTabBar: true,
    title: 'Edit Investment',
    backTo: '/app/investments',
  },
  component: EditInvestmentScreen,
})

const TYPE_OPTIONS: Array<{
  value: InvestmentType
  label: string
  icon: typeof LineChart
}> = [
  { value: 'stock', label: 'Stocks', icon: LineChart },
  { value: 'mutual_fund', label: 'Mutual Fund', icon: PieChart },
  { value: 'fd', label: 'Fixed Deposit', icon: Circle },
  { value: 'gold', label: 'Gold', icon: Coins },
  { value: 'crypto', label: 'Crypto', icon: Bitcoin },
  { value: 'sanchayapatra', label: 'Sanchayapatra', icon: Shield },
  { value: 'real_estate', label: 'Real Estate', icon: Building },
  { value: 'agro_farm', label: 'Agro Farm', icon: Sprout },
  { value: 'business', label: 'Business', icon: Briefcase },
  { value: 'other', label: 'Other', icon: Package },
]

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function EditInvestmentScreen() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const { data: investment, isLoading } = useInvestmentQuery(id)
  const updateInvestment = useUpdateInvestment()
  const deleteInvestment = useDeleteInvestment()
  const withdraw = useWithdraw(id)

  const [name, setName] = useState('')
  const [type, setType] = useState<InvestmentType>('stock')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [dateOfInvestment, setDateOfInvestment] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'active' | 'completed'>('active')
  const [exitValue, setExitValue] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Withdraw modal state
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [wAmount, setWAmount] = useState('')
  const [wDate, setWDate] = useState(todayIso())
  const [wNotes, setWNotes] = useState('')
  const [wError, setWError] = useState<string | null>(null)

  useEffect(() => {
    if (!investment) return
    setName(investment.name)
    setType(investment.type as InvestmentType)
    setInvestedAmount(String(investment.investedAmount))
    setCurrentValue(String(investment.currentValue))
    setDateOfInvestment(toDateInput(investment.dateOfInvestment))
    setNotes(investment.notes ?? '')
    setStatus(investment.status as 'active' | 'completed')
    setExitValue(investment.exitValue !== null ? investment.exitValue : '')
    setCompletedAt(toDateInput(investment.completedAt))
  }, [investment])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const parsed = investmentUpdateSchema.safeParse({
      id,
      name,
      type,
      investedAmount,
      currentValue,
      dateOfInvestment,
      notes: notes.trim() || undefined,
      status,
      exitValue: status === 'completed' ? exitValue : undefined,
      completedAt: status === 'completed' ? completedAt : undefined,
    })

    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !errs[key]) errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    try {
      await updateInvestment.mutateAsync(parsed.data)
      navigate({ to: '/app/investments' })
    } catch {
      // handled by useUpdateInvestment onError → toast.error
    }
  }

  async function handleDelete() {
    try {
      await deleteInvestment.mutateAsync(id)
      navigate({ to: '/app/investments' })
    } catch {
      // handled by useDeleteInvestment onError → toast.error
    }
  }

  function openWithdraw() {
    setWAmount('')
    setWDate(todayIso())
    setWNotes('')
    setWError(null)
    setShowWithdraw(true)
  }

  const wAmountNum = Number(wAmount)
  const wMaxAmount = investment ? Number(investment.currentValue) : 0
  const wIsFull = wAmountNum > 0 && Math.abs(wAmountNum - wMaxAmount) < 0.005

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    setWError(null)
    if (!wAmount || wAmountNum <= 0) {
      setWError('Enter an amount greater than 0')
      return
    }
    if (wAmountNum > wMaxAmount + 0.001) {
      setWError('Amount exceeds current value')
      return
    }
    try {
      await withdraw.mutateAsync({
        investmentId: id,
        amount: wAmount,
        withdrawalDate: wDate,
        notes: wNotes.trim() || undefined,
        closeInvestment: wIsFull,
      })
      setShowWithdraw(false)
    } catch {
      // handled in hook
    }
  }

  if (isLoading || !investment) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        Loading…
      </main>
    )
  }

  return (
    <main className="noir-bg min-h-dvh pb-32">
      <form onSubmit={handleSubmit} className="px-5 pt-4" noValidate>
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Asset details</p>
            <TextField
              id="name"
              label="Asset name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="investedAmount"
                label="Invested"
                inputMode="decimal"
                prefix={symbol}
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                error={fieldErrors.investedAmount}
              />
              <TextField
                id="currentValue"
                label="Current value"
                inputMode="decimal"
                prefix={symbol}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                error={fieldErrors.currentValue}
              />
            </div>
            <TextField
              id="dateOfInvestment"
              label="Date of investment"
              type="date"
              value={dateOfInvestment}
              onChange={(e) => setDateOfInvestment(e.target.value)}
              error={fieldErrors.dateOfInvestment}
            />
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Category</p>
            <div className="grid grid-cols-3 gap-3">
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    aria-pressed={active}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl p-4 text-xs font-semibold transition',
                      active
                        ? 'bg-primary-container text-on-primary-container shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)]'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container',
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <div className="flex items-center justify-between">
              <p className="label-sm text-on-surface-variant">Status</p>
              <div className="inline-flex gap-1 rounded-full bg-surface-container-lowest p-1">
                <StatusTab
                  active={status === 'active'}
                  onClick={() => setStatus('active')}
                >
                  Active
                </StatusTab>
                <StatusTab
                  active={status === 'completed'}
                  onClick={() => setStatus('completed')}
                >
                  Completed
                </StatusTab>
              </div>
            </div>
            {status === 'completed' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <TextField
                  id="exitValue"
                  label="Exit value"
                  inputMode="decimal"
                  prefix={symbol}
                  placeholder="0.00"
                  value={exitValue}
                  onChange={(e) => setExitValue(e.target.value)}
                  error={fieldErrors.exitValue}
                />
                <TextField
                  id="completedAt"
                  label="Completed on"
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  error={fieldErrors.completedAt}
                />
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Notes (optional)</p>
            <TextArea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </section>

          {investment.status === 'active' && (
            <button
              type="button"
              onClick={openWithdraw}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant/40 py-4 text-sm font-semibold text-on-surface-variant transition hover:border-outline-variant hover:text-on-surface"
            >
              <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
              Withdraw
            </button>
          )}

          {investment.withdrawals.length > 0 && (
            <section className="rounded-3xl bg-surface-container-low p-4">
              <h2 className="label-md mb-3 px-2 text-on-surface-variant">
                Withdrawal history
              </h2>
              <ul className="space-y-1">
                {investment.withdrawals.map((w) => {
                  const date = new Date(w.withdrawalDate)
                  return (
                    <li key={w.id}>
                      <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="body-sm text-on-surface">
                            {date.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          {w.notes && (
                            <p className="mt-0.5 text-xs text-on-surface-variant/70">
                              {w.notes}
                            </p>
                          )}
                        </div>
                        <p className="font-display text-sm font-bold text-tertiary">
                          −{formatCurrency(w.amount, currency)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-tertiary opacity-70 transition hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Remove investment
          </button>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/15 bg-surface/85 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <button
            type="submit"
            disabled={updateInvestment.isPending}
            className="btn-primary"
          >
            {updateInvestment.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmDelete}
        title="Remove investment"
        message={`Delete "${investment.name}"? This can't be undone.`}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={deleteInvestment.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      {showWithdraw && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setShowWithdraw(false)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card
              variant="low"
              className="rounded-t-3xl rounded-b-none sm:rounded-3xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="label-sm text-on-surface-variant">Withdraw</p>
                <button
                  type="button"
                  onClick={() => setShowWithdraw(false)}
                  className="text-on-surface-variant/60 hover:text-on-surface"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
              <p className="body-sm mb-4 text-on-surface-variant">
                Available: {formatCurrency(investment.currentValue, currency)}
              </p>
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    id="wAmount"
                    label="Amount"
                    placeholder="0.00"
                    inputMode="decimal"
                    prefix={symbol}
                    value={wAmount}
                    onChange={(e) => setWAmount(e.target.value)}
                    autoFocus
                    error={wError ?? undefined}
                  />
                  <TextField
                    id="wDate"
                    label="Date"
                    type="date"
                    value={wDate}
                    onChange={(e) => setWDate(e.target.value)}
                  />
                </div>
                <TextField
                  id="wNotes"
                  label="Notes (optional)"
                  placeholder="e.g. partial sale, FD breakage"
                  value={wNotes}
                  onChange={(e) => setWNotes(e.target.value)}
                />
                {wIsFull && (
                  <p className="text-xs text-on-surface-variant">
                    Full withdrawal — investment will be marked as closed.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={withdraw.isPending}
                  className="w-full rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
                >
                  {withdraw.isPending ? 'Recording…' : 'Confirm withdrawal'}
                </button>
              </form>
            </Card>
          </div>
        </div>
      )}
    </main>
  )
}

function StatusTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface-variant hover:text-on-surface',
      )}
    >
      {children}
    </button>
  )
}
