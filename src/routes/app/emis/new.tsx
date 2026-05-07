import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Building2, CreditCard } from 'lucide-react'
import { TextArea, TextField } from '#/components/ui/TextField'
import { calculateEmi } from '#/lib/emi-calculator'
import { cn } from '#/lib/cn'
import { getCurrencySymbol } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'
import { useCreateEmi } from '#/hooks/useEmis'
import { emiCreateSchema } from '#/lib/validators'
import type { EmiCreateInput, EmiType } from '#/lib/validators'

export const Route = createFileRoute('/app/emis/new')({
  staticData: {
    hideTabBar: true,
    title: 'pageTitles.addEmi',
    backTo: '/app/emis',
  },
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
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)
  const fmt = useFormatter()
  const { t } = useTranslation('emis')
  const { t: tCommon } = useTranslation('common')

  const createEmi = useCreateEmi()

  const [label, setLabel] = useState('')
  const [type, setType] = useState<EmiType>('bank_loan')
  const [principal, setPrincipal] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [tenureMonths, setTenureMonths] = useState<string>('')
  const [startDate, setStartDate] = useState(todayIso())
  const [processingFee, setProcessingFee] = useState('')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
      return calculateEmi({
        principal: p,
        annualRate: r,
        tenureMonths: n,
        type,
      })
    } catch {
      return null
    }
  }, [principal, interestRate, tenureMonths, type])

  // Total cost = principal + total interest + processing fee. Only meaningful
  // when the preview is computable; the fee is added on top whether or not
  // the user provided one.
  const totalCost = useMemo(() => {
    if (!preview) return null
    const fee = Number(processingFee)
    const feeNum = Number.isFinite(fee) && fee > 0 ? fee : 0
    return (Number(principal) + Number(preview.totalInterest) + feeNum).toFixed(
      2,
    )
  }, [preview, principal, processingFee])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const parsed = emiCreateSchema.safeParse({
      label,
      type,
      principal,
      interestRate,
      tenureMonths: Number(tenureMonths),
      startDate,
      processingFee: processingFee.trim() || undefined,
      notes: notes.trim() || undefined,
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
    } catch {
      // handled by useCreateEmi onError → toast.error
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <form onSubmit={handleSubmit} className="px-5 pt-4" noValidate>
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('form.section.details')}
            </p>
            <TextField
              id="label"
              label={t('form.labelLabel')}
              placeholder={t('form.labelPlaceholder')}
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
                label={t('types.bank_loan')}
              />
              <TypeButton
                active={type === 'credit_card'}
                onClick={() => setType('credit_card')}
                icon={<CreditCard className="h-5 w-5" strokeWidth={1.75} />}
                label={t('types.credit_card')}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('form.section.terms')}
            </p>
            <TextField
              id="principal"
              label={t('form.principalLabel')}
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
                label={t('form.rateLabel')}
                placeholder="0"
                inputMode="decimal"
                trailing="%"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                error={fieldErrors.interestRate}
              />
              <TextField
                id="tenureMonths"
                label={t('form.tenureLabel')}
                placeholder="12"
                inputMode="numeric"
                trailing={tCommon('units.months')}
                value={tenureMonths}
                onChange={(e) => setTenureMonths(e.target.value)}
                error={fieldErrors.tenureMonths}
              />
            </div>
            <TextField
              id="startDate"
              label={t('form.startDateLabel')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={fieldErrors.startDate}
            />
            <TextField
              id="processingFee"
              label={t('form.feeLabel')}
              placeholder="0.00"
              inputMode="decimal"
              prefix={symbol}
              value={processingFee}
              onChange={(e) => setProcessingFee(e.target.value)}
              error={fieldErrors.processingFee}
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
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10"
            />
            <p
              className={cn(
                'label-sm',
                preview
                  ? 'text-on-primary-container/80'
                  : 'text-on-surface-variant',
              )}
            >
              {t('form.monthlyEmi')}
            </p>
            <p
              className={cn(
                'font-display mt-2 text-4xl font-bold tracking-tight',
                preview
                  ? 'text-on-primary-container'
                  : 'text-on-surface-variant/60',
              )}
            >
              {preview
                ? fmt.currency(preview.emiAmount, currency)
                : fmt.currency(0, currency)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <PreviewCell
                active={Boolean(preview)}
                label={t('form.preview.totalPayment')}
                value={
                  preview ? fmt.currency(preview.totalPayment, currency) : '—'
                }
              />
              <PreviewCell
                active={Boolean(preview)}
                label={t('form.preview.totalInterest')}
                value={
                  preview ? fmt.currency(preview.totalInterest, currency) : '—'
                }
              />
              <PreviewCell
                active={Boolean(preview)}
                label={t('form.preview.processingFee')}
                value={
                  preview
                    ? fmt.currency(
                        Number(processingFee) > 0 ? processingFee : 0,
                        currency,
                      )
                    : '—'
                }
              />
              <PreviewCell
                active={Boolean(preview && totalCost)}
                label={t('form.preview.totalCost')}
                value={totalCost ? fmt.currency(totalCost, currency) : '—'}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('form.section.notes')}
            </p>
            <TextArea
              id="notes"
              placeholder={t('form.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/15 bg-surface/85 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <button
            type="submit"
            disabled={createEmi.isPending}
            className="btn-primary"
          >
            {createEmi.isPending ? t('form.submitting') : t('form.submit')}
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
          active
            ? 'text-on-primary-container/70'
            : 'text-on-surface-variant/70',
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
