import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TextArea, TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { getCurrencySymbol } from '#/lib/currency'
import { useCreateDps } from '#/hooks/useInvestments'
import { dpsCreateSchema } from '#/lib/validators'
import type { DpsCreateInput, DpsInterestType } from '#/lib/validators'

export const Route = createFileRoute('/app/investments/dps/new')({
  staticData: {
    hideTabBar: true,
    title: 'Add DPS Scheme',
    backTo: '/app/investments',
  },
  component: AddDpsScreen,
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function AddDpsScreen() {
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const createDps = useCreateDps()

  const [name, setName] = useState('')
  const [monthlyDeposit, setMonthlyDeposit] = useState('')
  const [tenureMonths, setTenureMonths] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [interestType, setInterestType] = useState<DpsInterestType>('compound')
  const [startDate, setStartDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const parsed = dpsCreateSchema.safeParse({
      name,
      monthlyDeposit,
      tenureMonths: tenureMonths ? Number(tenureMonths) : undefined,
      interestRate,
      interestType,
      startDate,
      notes: notes.trim() || undefined,
    } satisfies Partial<DpsCreateInput>)

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
      await createDps.mutateAsync(parsed.data)
      navigate({ to: '/app/investments' })
    } catch {
      // handled by useCreateDps onError → toast.error
    }
  }

  // Preview: maturity value estimate shown live
  const D = Number(monthlyDeposit) || 0
  const T = Number(tenureMonths) || 0
  const r = (Number(interestRate) || 0) / 1200
  let maturityPreview = 0
  if (D > 0 && T > 0) {
    if (interestType === 'compound') {
      maturityPreview =
        r === 0 ? D * T : (D * (1 + r) * (Math.pow(1 + r, T) - 1)) / r
    } else {
      maturityPreview = D * T + D * r * ((T * (T + 1)) / 2)
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <form onSubmit={handleSubmit} className="px-5 pt-4" noValidate>
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Scheme details</p>
            <TextField
              id="name"
              label="Scheme name"
              placeholder="e.g. BRAC Bank DPS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="monthlyDeposit"
                label="Monthly deposit"
                placeholder="0.00"
                inputMode="decimal"
                prefix={symbol}
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(e.target.value)}
                error={fieldErrors.monthlyDeposit}
              />
              <TextField
                id="tenureMonths"
                label="Tenure (months)"
                placeholder="36"
                inputMode="numeric"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(e.target.value)}
                error={fieldErrors.tenureMonths}
              />
            </div>
            <TextField
              id="startDate"
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={fieldErrors.startDate}
            />
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Interest</p>
            <TextField
              id="interestRate"
              label="Annual interest rate"
              placeholder="0.00"
              inputMode="decimal"
              trailing="%"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              error={fieldErrors.interestRate}
            />
            <div>
              <p className="label-sm mb-3 text-on-surface-variant">
                Interest type
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      value: 'simple' as DpsInterestType,
                      label: 'Simple',
                      desc: 'Flat rate on deposits',
                    },
                    {
                      value: 'compound' as DpsInterestType,
                      label: 'Compound',
                      desc: 'Monthly compounding',
                    },
                  ] as const
                ).map((opt) => {
                  const active = interestType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setInterestType(opt.value)}
                      aria-pressed={active}
                      className={cn(
                        'flex flex-col gap-1 rounded-2xl p-4 text-left transition',
                        active
                          ? 'bg-primary-container text-on-primary-container shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)]'
                          : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container',
                      )}
                    >
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {maturityPreview > 0 && (
              <div className="rounded-2xl bg-surface-container-lowest px-4 py-3">
                <p className="label-sm text-on-surface-variant">
                  Projected maturity value
                </p>
                <p className="font-display mt-1 text-lg font-bold text-secondary">
                  {symbol}
                  {maturityPreview.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="body-sm mt-0.5 text-on-surface-variant/70">
                  Total deposited:{' '}
                  <span className="font-medium text-on-surface-variant">
                    {symbol}
                    {(D * T).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </p>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Notes (optional)</p>
            <TextArea
              id="notes"
              placeholder="Bank name, account number, or any context"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/15 bg-surface/85 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <button
            type="submit"
            disabled={createDps.isPending}
            className="btn-primary"
          >
            {createDps.isPending ? 'Creating…' : 'Create DPS scheme'}
          </button>
        </div>
      </form>
    </main>
  )
}
