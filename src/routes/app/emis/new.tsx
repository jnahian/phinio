import { useMemo, useState } from 'react'
import {
  Link,
  createFileRoute,
  useNavigate,
} from '@tanstack/react-router'
import { ArrowLeft, Building2, CreditCard } from 'lucide-react'
import { TextField } from '#/components/ui/TextField'
import { calculateEmi } from '#/lib/emi-calculator'
import { cn } from '#/lib/cn'
import { formatCurrency, getCurrencySymbol  } from '#/lib/currency'
import type {Currency} from '#/lib/currency';
import { useCreateEmi } from '#/hooks/useEmis'
import {
  emiCreateSchema
  
  
} from '#/lib/validators'
import type {EmiCreateInput, EmiType} from '#/lib/validators';

export const Route = createFileRoute('/app/emis/new')({
  staticData: { hideTabBar: true },
  component: AddEmiScreen,
})

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function AddEmiScreen() {
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency as Currency
  const symbol = getCurrencySymbol(currency)

  const createEmi = useCreateEmi()

  const [label, setLabel] = useState('')
  const [type, setType] = useState<EmiType>('bank_loan')
  const [principal, setPrincipal] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [tenureMonths, setTenureMonths] = useState<string>('')
  const [startDate, setStartDate] = useState(todayIso())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Live preview: compute EMI breakdown whenever principal/rate/tenure are
  // all valid. Silently return null otherwise so the preview card hides.
  const preview = useMemo(() => {
    try {
      const p = Number(principal)
      const r = Number(interestRate)
      const n = Number(tenureMonths)
      if (!Number.isFinite(p) || p <= 0) return null
      if (!Number.isFinite(r) || r < 0) return null
      if (!Number.isInteger(n) || n <= 0) return null
      return calculateEmi({ principal: p, annualRate: r, tenureMonths: n })
    } catch {
      return null
    }
  }, [principal, interestRate, tenureMonths])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError(null)

    const parsed = emiCreateSchema.safeParse({
      label,
      type,
      principal,
      interestRate,
      tenureMonths: Number(tenureMonths),
      startDate,
    } satisfies EmiCreateInput)

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
      await createEmi.mutateAsync(parsed.data)
      navigate({ to: '/app/emis' })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-32">
      <header className="sticky top-0 z-40 flex items-center gap-4 bg-surface/80 px-5 py-4 backdrop-blur-xl">
        <Link
          to="/app/emis"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <h1 className="headline-sm text-on-surface">Add EMI</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-5 pt-4" noValidate>
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">EMI details</p>
            <TextField
              id="label"
              label="Label"
              placeholder="e.g. Home Loan — HSBC"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              error={fieldErrors.label}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <TypeButton
                active={type === 'bank_loan'}
                onClick={() => setType('bank_loan')}
                icon={<Building2 className="h-5 w-5" strokeWidth={1.75} />}
                label="Bank Loan"
              />
              <TypeButton
                active={type === 'credit_card'}
                onClick={() => setType('credit_card')}
                icon={<CreditCard className="h-5 w-5" strokeWidth={1.75} />}
                label="Credit Card"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Loan terms</p>
            <TextField
              id="principal"
              label="Principal amount"
              placeholder="0.00"
              inputMode="decimal"
              prefix={symbol}
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              error={fieldErrors.principal}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="interestRate"
                label="Annual rate"
                placeholder="0"
                inputMode="decimal"
                trailing="%"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                error={fieldErrors.interestRate}
              />
              <TextField
                id="tenureMonths"
                label="Tenure"
                placeholder="12"
                inputMode="numeric"
                trailing="months"
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

          <section
            className={cn(
              'relative overflow-hidden rounded-3xl p-6 transition-opacity',
              preview
                ? 'bg-gradient-to-br from-primary-container to-[#1e3a8a] opacity-100'
                : 'bg-surface-container-low opacity-60',
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"
            />
            <p
              className={cn(
                'label-sm',
                preview
                  ? 'text-on-primary-container/80'
                  : 'text-on-surface-variant',
              )}
            >
              Monthly EMI
            </p>
            <p
              className={cn(
                'font-display mt-2 text-4xl font-bold tracking-tight',
                preview ? 'text-on-primary-container' : 'text-on-surface-variant/60',
              )}
            >
              {preview
                ? formatCurrency(preview.emiAmount, currency)
                : formatCurrency(0, currency)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <PreviewCell
                active={Boolean(preview)}
                label="Total payment"
                value={
                  preview
                    ? formatCurrency(preview.totalPayment, currency)
                    : '—'
                }
              />
              <PreviewCell
                active={Boolean(preview)}
                label="Total interest"
                value={
                  preview
                    ? formatCurrency(preview.totalInterest, currency)
                    : '—'
                }
              />
            </div>
          </section>

          {formError && (
            <div
              role="alert"
              className="rounded-2xl bg-error-container/20 px-4 py-3 text-sm text-error"
            >
              {formError}
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/15 bg-surface/85 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <button
            type="submit"
            disabled={createEmi.isPending}
            className="btn-primary"
          >
            {createEmi.isPending ? 'Creating schedule…' : 'Create EMI'}
          </button>
        </div>
      </form>
    </main>
  )
}

function TypeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-3 rounded-2xl px-4 py-4 text-left transition',
        active
          ? 'bg-primary-container text-on-primary-container shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)]'
          : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container',
      )}
    >
      {icon}
      <span className="font-display font-semibold">{label}</span>
    </button>
  )
}

function PreviewCell({
  active,
  label,
  value,
}: {
  active: boolean
  label: string
  value: string
}) {
  return (
    <div>
      <p
        className={cn(
          'label-sm normal-case tracking-wide',
          active ? 'text-on-primary-container/70' : 'text-on-surface-variant/70',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-1 text-base font-bold',
          active ? 'text-on-primary-container' : 'text-on-surface-variant/60',
        )}
      >
        {value}
      </p>
    </div>
  )
}
