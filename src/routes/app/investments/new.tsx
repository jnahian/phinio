import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
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
} from 'lucide-react'
import { TextArea, TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { getCurrencySymbol } from '#/lib/currency'
import { useCreateInvestment } from '#/hooks/useInvestments'
import { investmentCreateSchema } from '#/lib/validators'
import type { InvestmentCreateInput, InvestmentType } from '#/lib/validators'

export const Route = createFileRoute('/app/investments/new')({
  staticData: {
    hideTabBar: true,
    title: 'Add Investment',
    backTo: '/app/investments',
  },
  component: AddInvestmentScreen,
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

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function AddInvestmentScreen() {
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const createInvestment = useCreateInvestment()

  const [name, setName] = useState('')
  const [type, setType] = useState<InvestmentType>('stock')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [dateOfInvestment, setDateOfInvestment] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const parsed = investmentCreateSchema.safeParse({
      name,
      type,
      investedAmount,
      currentValue,
      dateOfInvestment,
      notes: notes.trim() || undefined,
    } satisfies InvestmentCreateInput)

    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !errs[key]) errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    // Mutation errors are surfaced via toast at the hook layer. Swallow here
    // so the submit button state resets; the user sees the toast and stays
    // on the form with their inputs preserved.
    try {
      await createInvestment.mutateAsync(parsed.data)
      navigate({ to: '/app/investments' })
    } catch {
      // handled by useCreateInvestment onError → toast.error
    }
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
              placeholder="e.g. Vanguard S&P 500 ETF"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="investedAmount"
                label="Invested"
                placeholder="0.00"
                inputMode="decimal"
                prefix={symbol}
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                error={fieldErrors.investedAmount}
              />
              <TextField
                id="currentValue"
                label="Current value"
                placeholder="0.00"
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
            <p className="label-sm text-on-surface-variant">Notes (optional)</p>
            <TextArea
              id="notes"
              placeholder="Why this investment, goals, or any context"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/15 bg-surface/85 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <button
            type="submit"
            disabled={createInvestment.isPending}
            className="btn-primary"
          >
            {createInvestment.isPending ? 'Saving…' : 'Save investment'}
          </button>
        </div>
      </form>
    </main>
  )
}
