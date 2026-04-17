import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowDownLeft, ChevronRight, X } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { EmptyState } from '#/components/ui/EmptyState'
import { TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { formatCurrency, getCurrencySymbol } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import {
  useCloseDps,
  useInvestmentQuery,
  useInvestmentsQuery,
  useWithdraw,
} from '#/hooks/useInvestments'

export const Route = createFileRoute('/app/investments/withdraw')({
  staticData: {
    hideTabBar: true,
    title: 'Withdraw',
    backTo: '/app/investments',
  },
  component: GlobalWithdrawScreen,
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function GlobalWithdrawScreen() {
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const { data: items = [], isLoading } = useInvestmentsQuery({
    status: 'active',
    type: 'all',
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  )

  // Detail query — only enabled once a DPS is selected, so we can read the
  // most recent paid installment's accruedValue (the bank's current balance).
  const detailQuery = useInvestmentQuery(
    selected?.mode === 'scheduled' ? selectedId ?? '' : '',
  )

  if (isLoading) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        Loading…
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="noir-bg min-h-dvh px-5 pt-8">
        <EmptyState
          icon={<ArrowDownLeft className="h-7 w-7" strokeWidth={1.75} />}
          title="Nothing to withdraw from"
          description="You don't have any active investments yet."
        />
      </main>
    )
  }

  return (
    <main className="noir-bg min-h-dvh px-5 pb-32 pt-4">
      <p className="body-sm mb-3 text-on-surface-variant">
        Pick an investment to withdraw from. DPS schemes are closed
        prematurely.
      </p>

      <ul className="space-y-2">
        {items.map((item) => {
          const isSelected = item.id === selectedId
          const meta = describeMeta(item)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-pressed={isSelected}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl p-4 text-left transition',
                  isSelected
                    ? 'bg-primary-container/30 ring-1 ring-primary-container'
                    : 'bg-surface-container-low hover:bg-surface-container',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="body-sm truncate font-semibold text-on-surface">
                    {item.name}
                  </p>
                  <p className="text-xs text-on-surface-variant/70">{meta}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-bold text-on-surface">
                    {formatCurrency(item.currentValue, currency)}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-on-surface-variant/40 transition',
                    isSelected && 'rotate-90 text-on-surface',
                  )}
                  strokeWidth={1.75}
                />
              </button>
            </li>
          )
        })}
      </ul>

      {selected && selected.mode !== 'scheduled' && (
        <div className="mt-6">
          <WithdrawForm
            investmentId={selected.id}
            investmentName={selected.name}
            currentValue={selected.currentValue}
            symbol={symbol}
            currency={currency}
            onCancel={() => setSelectedId(null)}
            onDone={() => navigate({ to: '/app/investments' })}
          />
        </div>
      )}

      {selected && selected.mode === 'scheduled' && (
        <div className="mt-6">
          {detailQuery.isLoading || !detailQuery.data ? (
            <Card variant="low">
              <p className="body-sm text-on-surface-variant">Loading scheme…</p>
            </Card>
          ) : (
            <DpsCloseForm
              investmentId={selected.id}
              detail={detailQuery.data}
              symbol={symbol}
              currency={currency}
              onCancel={() => setSelectedId(null)}
              onDone={() => navigate({ to: '/app/investments' })}
            />
          )}
        </div>
      )}
    </main>
  )
}

function describeMeta(item: {
  mode: string
  type: string
  paidCount: number
  tenureMonths: number | null
}): string {
  if (item.mode === 'scheduled') {
    return `DPS · ${item.paidCount}/${item.tenureMonths} months paid`
  }
  if (item.mode === 'flexible') {
    return `Savings · ${item.paidCount} deposit${item.paidCount === 1 ? '' : 's'}`
  }
  return labelForType(item.type)
}

function labelForType(type: string): string {
  const labels: Record<string, string> = {
    stock: 'Stock',
    mutual_fund: 'Mutual Fund',
    fd: 'Fixed Deposit',
    gold: 'Gold',
    crypto: 'Crypto',
    sanchayapatra: 'Sanchayapatra',
    real_estate: 'Real Estate',
    agro_farm: 'Agro Farm',
    business: 'Business',
    other: 'Other',
  }
  return labels[type] ?? type
}

// ---------------------------------------------------------------------------
// Withdraw form (lump_sum + flexible)
// ---------------------------------------------------------------------------

function WithdrawForm({
  investmentId,
  investmentName,
  currentValue,
  symbol,
  currency,
  onCancel,
  onDone,
}: {
  investmentId: string
  investmentName: string
  currentValue: string
  symbol: string
  currency: Currency
  onCancel: () => void
  onDone: () => void
}) {
  const withdraw = useWithdraw(investmentId)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const max = Number(currentValue)
  const amountNum = Number(amount)
  const isFull = amountNum > 0 && Math.abs(amountNum - max) < 0.005

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!amount || amountNum <= 0) {
      setError('Enter an amount greater than 0')
      return
    }
    if (amountNum > max + 0.001) {
      setError('Amount exceeds current value')
      return
    }
    try {
      await withdraw.mutateAsync({
        investmentId,
        amount,
        withdrawalDate: date,
        notes: notes.trim() || undefined,
        closeInvestment: isFull,
      })
      onDone()
    } catch {
      // toast handled in hook
    }
  }

  return (
    <Card variant="low">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-sm text-on-surface-variant">
          Withdraw from {investmentName}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-on-surface-variant/60 hover:text-on-surface"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <p className="body-sm mb-4 text-on-surface-variant">
        Available: {formatCurrency(currentValue, currency)}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="wAmount"
            label="Amount"
            placeholder="0.00"
            inputMode="decimal"
            prefix={symbol}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            error={error ?? undefined}
          />
          <TextField
            id="wDate"
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <TextField
          id="wNotes"
          label="Notes (optional)"
          placeholder="e.g. partial sale, emergency"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {isFull && (
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
  )
}

// ---------------------------------------------------------------------------
// DPS premature-closure form (scheduled mode)
// ---------------------------------------------------------------------------

function DpsCloseForm({
  investmentId,
  detail,
  symbol,
  currency,
  onCancel,
  onDone,
}: {
  investmentId: string
  detail: {
    name: string
    investedAmount: string
    deposits: Array<{
      installmentNumber: number | null
      status: string
      accruedValue: string | null
    }>
  }
  symbol: string
  currency: Currency
  onCancel: () => void
  onDone: () => void
}) {
  const closeDps = useCloseDps(investmentId)

  const paidSorted = useMemo(
    () =>
      [...detail.deposits]
        .filter((d) => d.status === 'paid')
        .sort(
          (a, b) => (b.installmentNumber ?? 0) - (a.installmentNumber ?? 0),
        ),
    [detail.deposits],
  )
  const accruedNow =
    (paidSorted.length > 0 ? paidSorted[0].accruedValue : null) ??
    detail.investedAmount
  const upcomingCount = detail.deposits.filter(
    (d) => d.status !== 'paid',
  ).length

  const [received, setReceived] = useState(String(accruedNow))
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!received || Number(received) <= 0) {
      setError('Enter the amount received')
      return
    }
    try {
      await closeDps.mutateAsync({
        investmentId,
        receivedAmount: received,
        closureDate: date,
        notes: notes.trim() || undefined,
      })
      onDone()
    } catch {
      // toast handled in hook
    }
  }

  return (
    <Card variant="low">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-sm text-on-surface-variant">
          Close DPS prematurely — {detail.name}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-on-surface-variant/60 hover:text-on-surface"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <p className="body-sm mb-4 text-on-surface-variant">
        Accrued so far: {formatCurrency(accruedNow, currency)}. Banks often
        deduct a penalty — enter the amount you actually receive.{' '}
        {upcomingCount} upcoming installment{upcomingCount !== 1 ? 's' : ''}{' '}
        will be cancelled.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="cReceived"
            label="Amount received"
            placeholder="0.00"
            inputMode="decimal"
            prefix={symbol}
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            autoFocus
            error={error ?? undefined}
          />
          <TextField
            id="cDate"
            label="Closure date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <TextField
          id="cNotes"
          label="Notes (optional)"
          placeholder="e.g. emergency, switched bank"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
  )
}
