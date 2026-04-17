import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { TextField } from '#/components/ui/TextField'
import { formatCurrency, getCurrencySymbol } from '#/lib/currency'
import type { Currency } from '#/lib/currency'
import {
  useCloseDps,
  useInvestmentQuery,
  useInvestmentsQuery,
  useWithdraw,
} from '#/hooks/useInvestments'

interface WithdrawModalProps {
  open: boolean
  onClose: () => void
  currency: Currency
  /** Pre-select an investment (used when opening from a detail screen). */
  preselectedInvestmentId?: string
  /** Optional callback after a successful withdrawal/closure. */
  onSuccess?: () => void
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function WithdrawModal({
  open,
  onClose,
  currency,
  preselectedInvestmentId,
  onSuccess,
}: WithdrawModalProps) {
  const symbol = getCurrencySymbol(currency)
  const { data: items = [], isLoading } = useInvestmentsQuery({
    status: 'active',
    type: 'all',
  })

  const [selectedId, setSelectedId] = useState<string>(
    preselectedInvestmentId ?? '',
  )

  // Reset selection when the modal opens (so reopening picks up new preselect).
  useEffect(() => {
    if (open) setSelectedId(preselectedInvestmentId ?? '')
  }, [open, preselectedInvestmentId])

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  )

  // For DPS, fetch detail to read the latest paid installment's accruedValue.
  const detailQuery = useInvestmentQuery(
    selected?.mode === 'scheduled' ? selectedId : '',
  )

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <Card
          variant="low"
          className="rounded-t-3xl rounded-b-none sm:rounded-3xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="label-sm text-on-surface-variant">Withdraw</p>
            <button
              type="button"
              onClick={onClose}
              className="text-on-surface-variant/60 hover:text-on-surface"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <InvestmentPicker
            items={items}
            isLoading={isLoading}
            selectedId={selectedId}
            onChange={setSelectedId}
          />

          {selected && selected.mode !== 'scheduled' && (
            <div className="mt-4">
              <WithdrawFields
                investmentId={selected.id}
                currentValue={selected.currentValue}
                symbol={symbol}
                currency={currency}
                onDone={() => {
                  onSuccess?.()
                  onClose()
                }}
              />
            </div>
          )}

          {selected && selected.mode === 'scheduled' && (
            <div className="mt-4">
              {detailQuery.isLoading || !detailQuery.data ? (
                <p className="body-sm text-on-surface-variant">
                  Loading scheme…
                </p>
              ) : (
                <DpsCloseFields
                  investmentId={selected.id}
                  detail={detailQuery.data}
                  symbol={symbol}
                  currency={currency}
                  onDone={() => {
                    onSuccess?.()
                    onClose()
                  }}
                />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Investment picker — native select styled to match the design tokens
// ---------------------------------------------------------------------------

interface PickerItem {
  id: string
  name: string
  mode: string
  type: string
  paidCount: number
  tenureMonths: number | null
}

function InvestmentPicker({
  items,
  isLoading,
  selectedId,
  onChange,
}: {
  items: PickerItem[]
  isLoading: boolean
  selectedId: string
  onChange: (id: string) => void
}) {
  if (isLoading) {
    return (
      <p className="body-sm text-on-surface-variant">Loading investments…</p>
    )
  }
  if (items.length === 0) {
    return (
      <p className="body-sm text-on-surface-variant">
        No active investments to withdraw from.
      </p>
    )
  }

  return (
    <label className="block">
      <span className="label-sm mb-1.5 block text-on-surface-variant">
        Investment
      </span>
      <div className="relative">
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl bg-surface-container-lowest px-4 py-3 pr-10 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
        >
          <option value="" disabled>
            Select an investment…
          </option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {pickerLabel(item)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
          strokeWidth={1.75}
        />
      </div>
    </label>
  )
}

function pickerLabel(item: PickerItem): string {
  if (item.mode === 'scheduled') return `${item.name} (DPS — close)`
  if (item.mode === 'flexible') return `${item.name} (Savings)`
  return `${item.name} (${labelForType(item.type)})`
}

function labelForType(type: string): string {
  const labels: Record<string, string> = {
    stock: 'Stock',
    mutual_fund: 'Mutual Fund',
    fd: 'FD',
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
// Withdraw fields (lump_sum + flexible)
// ---------------------------------------------------------------------------

function WithdrawFields({
  investmentId,
  currentValue,
  symbol,
  currency,
  onDone,
}: {
  investmentId: string
  currentValue: string
  symbol: string
  currency: Currency
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="body-sm text-on-surface-variant">
        Available: {formatCurrency(currentValue, currency)}
      </p>
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
  )
}

// ---------------------------------------------------------------------------
// DPS premature-closure fields (scheduled mode)
// ---------------------------------------------------------------------------

function DpsCloseFields({
  investmentId,
  detail,
  symbol,
  currency,
  onDone,
}: {
  investmentId: string
  detail: {
    investedAmount: string
    deposits: Array<{
      installmentNumber: number | null
      status: string
      accruedValue: string | null
    }>
  }
  symbol: string
  currency: Currency
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

  // Reset the received default if the user switches between DPS schemes.
  useEffect(() => {
    setReceived(String(accruedNow))
  }, [accruedNow])

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="body-sm text-on-surface-variant">
        Accrued so far: {formatCurrency(accruedNow, currency)}. Banks often
        deduct a penalty — enter the amount you actually receive.{' '}
        {upcomingCount} upcoming installment{upcomingCount !== 1 ? 's' : ''}{' '}
        will be cancelled.
      </p>
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
  )
}
