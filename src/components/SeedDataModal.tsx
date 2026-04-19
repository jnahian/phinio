import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { cn } from '#/lib/cn'
import type { SeedCategories } from '#/server/dev-data'

interface SeedDataModalProps {
  open: boolean
  isPending: boolean
  onConfirm: (input: {
    categories: SeedCategories
    wipe: boolean
  }) => Promise<void> | void
  onCancel: () => void
}

const DEFAULT_CATEGORIES: SeedCategories = {
  lumpSum: true,
  dps: true,
  savings: true,
  emis: true,
}

export function SeedDataModal({
  open,
  isPending,
  onConfirm,
  onCancel,
}: SeedDataModalProps) {
  const [categories, setCategories] =
    useState<SeedCategories>(DEFAULT_CATEGORIES)
  const [wipe, setWipe] = useState(true)

  useEffect(() => {
    if (open) {
      setCategories(DEFAULT_CATEGORIES)
      setWipe(true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, isPending, onCancel])

  if (!open) return null

  const anySelected = Object.values(categories).some(Boolean)
  const canSubmit = !isPending && (wipe || anySelected)

  function toggle(key: keyof SeedCategories) {
    setCategories((c) => ({ ...c, [key]: !c[key] }))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-surface-container-lowest/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onCancel()
      }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-surface-container-high p-6 text-on-surface shadow-[0_20px_60px_-10px_rgba(6,14,32,0.8)]">
        <h2 className="font-display mb-1 text-base font-semibold text-on-surface">
          Load test data
        </h2>
        <p className="body-sm mb-5 text-on-surface-variant">
          Populate your profile with realistic demo portfolios and EMIs.
        </p>

        <div className="mb-4 space-y-1">
          <CheckboxRow
            label="Lump-sum investments"
            hint="Stocks, mutual funds, FDs, gold, crypto"
            checked={categories.lumpSum}
            disabled={isPending}
            onToggle={() => toggle('lumpSum')}
          />
          <CheckboxRow
            label="DPS (scheduled)"
            hint="Fixed monthly deposit schemes"
            checked={categories.dps}
            disabled={isPending}
            onToggle={() => toggle('dps')}
          />
          <CheckboxRow
            label="Savings pots"
            hint="Flexible, ad-hoc deposits"
            checked={categories.savings}
            disabled={isPending}
            onToggle={() => toggle('savings')}
          />
          <CheckboxRow
            label="EMIs"
            hint="Loans and credit-card instalments"
            checked={categories.emis}
            disabled={isPending}
            onToggle={() => toggle('emis')}
          />
        </div>

        <div className="mb-6 rounded-xl border border-outline-variant/30 p-3">
          <CheckboxRow
            label="Wipe existing data first"
            hint="Recommended — avoids duplicates"
            checked={wipe}
            disabled={isPending}
            onToggle={() => setWipe((w) => !w)}
            compact
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-on-surface transition hover:bg-white/5 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ categories, wipe })}
            disabled={!canSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-container px-4 py-3 font-display font-semibold text-on-primary-container shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] transition disabled:opacity-60"
          >
            {isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container" />
            ) : (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            )}
            {isPending ? 'Loading…' : 'Load data'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CheckboxRow({
  label,
  hint,
  checked,
  disabled,
  onToggle,
  compact,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl text-left transition disabled:opacity-60',
        compact ? 'py-0' : 'px-3 py-2.5 hover:bg-white/5',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
          checked
            ? 'border-transparent bg-primary-container text-on-primary-container'
            : 'border-outline-variant/50 bg-transparent',
        )}
      >
        {checked ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : (
          <X className="h-0 w-0" />
        )}
      </span>
      <span className="flex-1">
        <span className="block font-display text-sm font-semibold text-on-surface">
          {label}
        </span>
        {hint && (
          <span className="body-sm text-on-surface-variant">{hint}</span>
        )}
      </span>
    </button>
  )
}
