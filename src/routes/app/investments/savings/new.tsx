import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TextArea, TextField } from '#/components/ui/TextField'
import { getCurrencySymbol } from '#/lib/currency'
import { useCreateSavings } from '#/hooks/useInvestments'
import { savingsCreateSchema } from '#/lib/validators'
import type { SavingsCreateInput } from '#/lib/validators'

export const Route = createFileRoute('/app/investments/savings/new')({
  staticData: { hideTabBar: true, title: 'Add Savings Pot', backTo: '/app/investments' },
  component: AddSavingsScreen,
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function AddSavingsScreen() {
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const createSavings = useCreateSavings()

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [currentValue, setCurrentValue] = useState('0')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const parsed = savingsCreateSchema.safeParse({
      name,
      startDate,
      currentValue: currentValue || '0',
      notes: notes.trim() || undefined,
    } satisfies Partial<SavingsCreateInput>)

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
      const result = await createSavings.mutateAsync(parsed.data)
      navigate({ to: '/app/investments/savings/$id', params: { id: result.id } })
    } catch {
      // handled by hook onError → toast.error
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-32">
      <form onSubmit={handleSubmit} className="px-5 pt-4" noValidate>
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">Pot details</p>
            <TextField
              id="name"
              label="Name"
              placeholder="e.g. Emergency Fund, Vacation Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              autoFocus
            />
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
            <p className="label-sm text-on-surface-variant">
              Current balance (optional)
            </p>
            <TextField
              id="currentValue"
              label="Current balance"
              placeholder="0.00"
              inputMode="decimal"
              prefix={symbol}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              error={fieldErrors.currentValue}
            />
            <p className="body-sm text-on-surface-variant/70">
              Set this to your current account balance if you're tracking an
              existing pot. You can update it anytime.
            </p>
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
            disabled={createSavings.isPending}
            className="btn-primary"
          >
            {createSavings.isPending ? 'Creating…' : 'Create savings pot'}
          </button>
        </div>
      </form>
    </main>
  )
}
