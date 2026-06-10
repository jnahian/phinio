import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
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
} from 'lucide-react'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { TextArea, TextField } from '#/components/ui/TextField'
import { WithdrawModal } from '#/components/WithdrawModal'
import { cn } from '#/lib/cn'
import { getCurrencySymbol } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'
import {
  useDeleteInvestment,
  useInvestmentQuery,
  useUpdateInvestment,
} from '#/hooks/useInvestments'
import { investmentUpdateSchema } from '@phinio/validators'
import type { InvestmentType } from '@phinio/validators'

export const Route = createFileRoute('/app/investments/$id/edit')({
  staticData: {
    hideTabBar: true,
    title: 'pageTitles.editInvestment',
    backTo: '/app/investments',
  },
  component: EditInvestmentScreen,
})

const TYPE_OPTIONS: Array<{
  value: InvestmentType
  icon: typeof LineChart
}> = [
  { value: 'stock', icon: LineChart },
  { value: 'mutual_fund', icon: PieChart },
  { value: 'fd', icon: Circle },
  { value: 'gold', icon: Coins },
  { value: 'crypto', icon: Bitcoin },
  { value: 'sanchayapatra', icon: Shield },
  { value: 'real_estate', icon: Building },
  { value: 'agro_farm', icon: Sprout },
  { value: 'business', icon: Briefcase },
  { value: 'other', icon: Package },
]

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function EditInvestmentScreen() {
  const { t } = useTranslation('investments')
  const { t: tCommon } = useTranslation('common')
  const fmt = useFormatter()
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)

  const { data: investment, isLoading } = useInvestmentQuery(id)
  const updateInvestment = useUpdateInvestment()
  const deleteInvestment = useDeleteInvestment()

  const [name, setName] = useState('')
  const [type, setType] = useState<InvestmentType>('stock')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [dateOfInvestment, setDateOfInvestment] = useState('')
  const [estimatedClosureDate, setEstimatedClosureDate] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'active' | 'completed'>('active')
  const [exitValue, setExitValue] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [showWithdraw, setShowWithdraw] = useState(false)

  useEffect(() => {
    if (!investment) return
    setName(investment.name)
    setType(investment.type as InvestmentType)
    setInvestedAmount(String(investment.investedAmount))
    setCurrentValue(String(investment.currentValue))
    setDateOfInvestment(toDateInput(investment.dateOfInvestment))
    setEstimatedClosureDate(toDateInput(investment.estimatedClosureDate))
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
      estimatedClosureDate: estimatedClosureDate || undefined,
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
      await deleteInvestment.mutateAsync({ id })
      navigate({ to: '/app/investments' })
    } catch {
      // handled by useDeleteInvestment onError → toast.error
    }
  }

  if (isLoading || !investment) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        {tCommon('actions.loading')}
      </main>
    )
  }

  const investedNum = Number(investment.investedAmount)
  const currentNum = Number(investment.currentValue)
  const withdrawnNum = investment.withdrawals.reduce(
    (s, w) => s + Number(w.amount),
    0,
  )
  const returnPct =
    investedNum > 0
      ? Math.round(
          ((currentNum + withdrawnNum - investedNum) / investedNum) * 10000,
        ) / 100
      : 0
  const hasReturn = investedNum > 0

  return (
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <form onSubmit={handleSubmit} className="px-5 pt-4" noValidate>
        <div className="space-y-6">
          {/* Hero card */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3147] to-[#0f1f2d] p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10"
            />
            <p className="label-sm text-white/70">
              {t('form.currentValueLabel')}
            </p>
            <p className="font-display mt-2 text-4xl font-bold tracking-tight text-white">
              {fmt.currency(investment.currentValue, currency)}
            </p>
            {hasReturn && (
              <p
                className={cn(
                  'body-sm mt-2 font-semibold',
                  returnPct > 0
                    ? 'text-[#60a5fa]'
                    : returnPct < 0
                      ? 'text-tertiary'
                      : 'text-white/70',
                )}
              >
                {returnPct > 0 ? '+' : ''}
                {fmt.number(returnPct)}% {t('list.returnSuffix')}
              </p>
            )}
            {investment.status === 'active' && (
              <button
                type="button"
                onClick={() => setShowWithdraw(true)}
                className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <ArrowDownLeft className="h-4 w-4" strokeWidth={2} />
                {t('list.withdraw')}
              </button>
            )}
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('form.section.details')}
            </p>
            <TextField
              id="name"
              label={t('form.nameLabel')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="investedAmount"
                label={t('form.investedLabel')}
                inputMode="decimal"
                prefix={symbol}
                value={investedAmount}
                onChange={(e) => setInvestedAmount(e.target.value)}
                error={fieldErrors.investedAmount}
              />
              <TextField
                id="currentValue"
                label={t('form.currentValueLabel')}
                inputMode="decimal"
                prefix={symbol}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                error={fieldErrors.currentValue}
              />
            </div>
            <TextField
              id="dateOfInvestment"
              label={t('form.dateLabel')}
              type="date"
              value={dateOfInvestment}
              onChange={(e) => setDateOfInvestment(e.target.value)}
              error={fieldErrors.dateOfInvestment}
            />
            <TextField
              id="estimatedClosureDate"
              label={t('form.estimatedClosureLabel')}
              type="date"
              value={estimatedClosureDate}
              onChange={(e) => setEstimatedClosureDate(e.target.value)}
              error={fieldErrors.estimatedClosureDate}
            />
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {t('form.section.category')}
            </p>
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
                    {t(`types.${opt.value}`)}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <div className="flex items-center justify-between">
              <p className="label-sm text-on-surface-variant">
                {t('form.section.status')}
              </p>
              <div className="inline-flex gap-1 rounded-full bg-surface-container-lowest p-1">
                <StatusTab
                  active={status === 'active'}
                  onClick={() => setStatus('active')}
                >
                  {t('list.active')}
                </StatusTab>
                <StatusTab
                  active={status === 'completed'}
                  onClick={() => setStatus('completed')}
                >
                  {t('list.completed')}
                </StatusTab>
              </div>
            </div>
            {status === 'completed' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <TextField
                  id="exitValue"
                  label={t('form.exitValueLabel')}
                  inputMode="decimal"
                  prefix={symbol}
                  placeholder="0.00"
                  value={exitValue}
                  onChange={(e) => setExitValue(e.target.value)}
                  error={fieldErrors.exitValue}
                />
                <TextField
                  id="completedAt"
                  label={t('form.completionDateLabel')}
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  error={fieldErrors.completedAt}
                />
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-3xl bg-surface-container-low p-6">
            <p className="label-sm text-on-surface-variant">
              {tCommon('labels.notesOptional')}
            </p>
            <TextArea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </section>

          {investment.withdrawals.length > 0 && (
            <section className="rounded-3xl bg-surface-container-low p-4">
              <h2 className="label-md mb-3 px-2 text-on-surface-variant">
                {t('form.withdrawals')}
              </h2>
              <ul className="space-y-1">
                {investment.withdrawals.map((w) => {
                  const date = new Date(w.withdrawalDate)
                  return (
                    <li key={w.id}>
                      <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="body-sm text-on-surface">
                            {fmt.date(date, {
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
                          −{fmt.currency(w.amount, currency)}
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
            {t('form.delete')}
          </button>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/15 bg-surface/85 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
          <button
            type="submit"
            disabled={updateInvestment.isPending}
            className="btn-primary"
          >
            {updateInvestment.isPending
              ? tCommon('actions.saving')
              : tCommon('actions.saveChanges')}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmDelete}
        title={t('form.deleteConfirmTitle')}
        message={t('form.deleteConfirmBody', { name: investment.name })}
        confirmLabel={t('form.deleteConfirm')}
        pendingLabel={t('form.deletePending')}
        isPending={deleteInvestment.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <WithdrawModal
        open={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        currency={currency}
        preselectedInvestmentId={id}
      />
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
