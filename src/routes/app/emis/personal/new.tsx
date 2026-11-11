import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { TextArea, TextField } from '#/components/ui/TextField'
import { cn } from '#/lib/cn'
import { getCurrencySymbol } from '#/lib/currency'
import { useCreatePersonalLoan } from '#/hooks/usePersonalLoans'
import { personalLoanCreateSchema } from '#/lib/validators'
import type { LoanDirection, PersonalLoanCreateInput } from '#/lib/validators'

export const Route = createFileRoute('/app/emis/personal/new')({
  staticData: {
    hideTabBar: true,
    title: 'pageTitles.addPersonalLoan',
    backTo: '/app/emis/personal',
  },
  component: AddPersonalLoanScreen,
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function AddPersonalLoanScreen() {
  const { t } = useTranslation('emis')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const symbol = getCurrencySymbol(profile.preferredCurrency)

  const createLoan = useCreatePersonalLoan()

  const [direction, setDirection] = useState<LoanDirection>('borrowed')
  const [counterparty, setCounterparty] = useState('')
  const [principal, setPrincipal] = useState('')
  const [totalRepayable, setTotalRepayable] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})

    const parsed = personalLoanCreateSchema.safeParse({
      direction,
      counterparty,
      principal,
      totalRepayable: totalRepayable.trim() || undefined,
      startDate,
      notes: notes.trim() || undefined,
    } satisfies Partial<PersonalLoanCreateInput>)

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
      const result = await createLoan.mutateAsync(parsed.data)
      navigate({
        to: '/app/emis/personal/$loanId',
        params: { loanId: result.id },
      })
    } catch {
      // handled by hook onError → toast.error
    }
  }

  const isBorrowed = direction === 'borrowed'

  return (
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <form onSubmit={handleSubmit} className="px-5 pt-4" noValidate>
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('personal.form.section.details')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <DirectionButton
                active={isBorrowed}
                onClick={() => setDirection('borrowed')}
                icon={<ArrowDownLeft className="h-5 w-5" strokeWidth={1.75} />}
                label={t('personal.directions.borrowed')}
              />
              <DirectionButton
                active={!isBorrowed}
                onClick={() => setDirection('lent')}
                icon={<ArrowUpRight className="h-5 w-5" strokeWidth={1.75} />}
                label={t('personal.directions.lent')}
              />
            </div>
            <TextField
              id="counterparty"
              label={
                isBorrowed
                  ? t('personal.form.counterpartyBorrowed')
                  : t('personal.form.counterpartyLent')
              }
              placeholder={t('personal.form.counterpartyPlaceholder')}
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              error={fieldErrors.counterparty}
              autoFocus
            />
            <TextField
              id="startDate"
              label={
                isBorrowed
                  ? t('personal.form.dateBorrowed')
                  : t('personal.form.dateLent')
              }
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={fieldErrors.startDate}
            />
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('personal.form.section.amounts')}
            </p>
            <TextField
              id="principal"
              label={t('personal.form.principalLabel')}
              placeholder="0.00"
              inputMode="decimal"
              prefix={symbol}
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              error={fieldErrors.principal}
            />
            <TextField
              id="totalRepayable"
              label={t('personal.form.totalLabel')}
              placeholder="0.00"
              inputMode="decimal"
              prefix={symbol}
              value={totalRepayable}
              onChange={(e) => setTotalRepayable(e.target.value)}
              error={fieldErrors.totalRepayable}
            />
            <p className="body-sm text-on-surface-variant/70">
              {t('personal.form.totalHint')}
            </p>
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('personal.form.section.notes')}
            </p>
            <TextArea
              id="notes"
              placeholder={t('personal.form.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/15 bg-surface/85 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <button
            type="submit"
            disabled={createLoan.isPending}
            className="btn-primary"
          >
            {createLoan.isPending
              ? tCommon('actions.creating')
              : t('personal.form.submit')}
          </button>
        </div>
      </form>
    </main>
  )
}

function DirectionButton({
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
