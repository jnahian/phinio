import { Suspense, lazy, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Check, Pencil, Trash2 } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { TextArea, TextField } from '#/components/ui/TextField'
import { useSetTopBarTitle } from '#/lib/top-bar-context'
import { cn } from '#/lib/cn'
import { useFormatter } from '#/lib/i18n/useFormatter'
import { isFeePayment, isRegularPayment } from '#/lib/emi-calculator'
import {
  useCompleteEmi,
  useDeleteEmi,
  useEmiQuery,
  useMarkPayment,
  useUpdateEmi,
} from '#/hooks/useEmis'

const PrincipalInterestDonut = lazy(
  () => import('#/components/PrincipalInterestDonut'),
)

type PiSegment = 'Principal' | 'Interest'

export const Route = createFileRoute('/app/emis/$emiId')({
  staticData: { hideTabBar: true, backTo: '/app/emis' },
  component: EmiDetailScreen,
})

function EmiDetailScreen() {
  const { t } = useTranslation('emis')
  const { t: tCommon } = useTranslation('common')
  const { emiId } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const fmt = useFormatter()

  const { data: emi, isLoading } = useEmiQuery(emiId)
  useSetTopBarTitle(emi?.label ?? null)
  const markPayment = useMarkPayment(emiId)
  const deleteEmi = useDeleteEmi()
  const updateEmi = useUpdateEmi()
  const completeEmi = useCompleteEmi()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [selectedSegment, setSelectedSegment] = useState<PiSegment | null>(null)
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState('')
  const [editNotes, setEditNotes] = useState('')

  if (isLoading || !emi) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        {tCommon('actions.loading')}
      </main>
    )
  }

  const payments = emi.payments
  // Exclude the sentinel fee row from any monthly-schedule aggregation: it
  // isn't principal, isn't interest, and isn't part of "X of N months".
  const regularPayments = payments.filter(isRegularPayment)
  const paidCount = regularPayments.filter((p) => p.status === 'paid').length
  const remainingMonths = emi.tenureMonths - paidCount
  const isCompleted = emi.status === 'completed'
  const interestPaid = regularPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.interestComponent), 0)
  const principalPaid = regularPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.principalComponent), 0)
  const remainingBalance = regularPayments
    .filter((p) => p.status !== 'paid')
    .reduce((sum, p) => sum + Number(p.emiAmount), 0)
  const totalLifetimePayment = regularPayments.reduce(
    (sum, p) => sum + Number(p.emiAmount),
    0,
  )
  const totalInterest = Math.max(
    0,
    totalLifetimePayment - Number(emi.principal),
  )
  const processingFee = Number(emi.processingFee ?? 0)
  const totalCost = Number(emi.principal) + totalInterest + processingFee
  const now = new Date()

  async function handleDelete() {
    try {
      await deleteEmi.mutateAsync({ emiId })
      navigate({ to: '/app/emis' })
    } catch {
      // Keep user on page; error surface can be improved later.
    }
  }

  async function handleComplete() {
    try {
      await completeEmi.mutateAsync({ emiId })
      setConfirmComplete(false)
    } catch {
      // toast handled in hook
    }
  }

  function openEdit() {
    if (!emi) return
    setEditLabel(emi.label)
    setEditNotes(emi.notes ?? '')
    setEditing(true)
  }

  async function handleEditSave() {
    if (!emi) return
    try {
      await updateEmi.mutateAsync({
        emiId,
        label: editLabel.trim() || emi.label,
        notes: editNotes.trim() || undefined,
      })
      setEditing(false)
    } catch {
      // toast handled in hook
    }
  }

  return (
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="space-y-6 px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="body-sm text-on-surface-variant">
              {emi.type === 'credit_card'
                ? t('types.credit_card')
                : t('types.bank_loan')}{' '}
              · {emi.interestRate}% p.a.
            </p>
            {isCompleted && (
              <span className="label-sm inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-secondary normal-case tracking-wide">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                {t('status.completed')}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label={t('detail.edit')}
            onClick={openEdit}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-white/5"
          >
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-container to-[#1e3a8a] p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10"
          />
          <p className="label-sm text-on-primary-container/75">
            {t('detail.remainingBalance')}
          </p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-on-primary-container">
            {fmt.currency(remainingBalance.toFixed(2), currency)}
          </p>
          <p className="body-sm mt-2 text-on-primary-container/75">
            {fmt.number(remainingMonths)} / {fmt.number(emi.tenureMonths)}{' '}
            {tCommon('units.months')}
          </p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <StatTile
            label={t('detail.monthly')}
            value={fmt.currency(emi.emiAmount, currency)}
          />
          <StatTile
            label={t('detail.principalPaid')}
            value={fmt.currency(principalPaid.toFixed(2), currency)}
          />
          <StatTile
            label={t('detail.interestPaid')}
            value={fmt.currency(interestPaid.toFixed(2), currency)}
            accent="tertiary"
          />
        </section>

        <section className="rounded-3xl bg-surface-container-low p-6">
          <h2 className="label-md mb-4 text-on-surface-variant">
            {t('detail.principalVsInterest')}
          </h2>
          <Suspense
            fallback={
              <div className="h-48 animate-pulse rounded-2xl bg-surface-container-lowest" />
            }
          >
            <PrincipalInterestDonut
              principal={Number(emi.principal)}
              interest={totalInterest}
              selectedSegment={selectedSegment}
            />
          </Suspense>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <LegendPill
              color="bg-primary-container"
              label={t('detail.principal')}
              value={fmt.currency(emi.principal, currency)}
              selected={selectedSegment === 'Principal'}
              dimmed={
                selectedSegment !== null && selectedSegment !== 'Principal'
              }
              onClick={() =>
                setSelectedSegment((prev) =>
                  prev === 'Principal' ? null : 'Principal',
                )
              }
            />
            <LegendPill
              color="bg-tertiary-container"
              label={t('detail.interestComponent')}
              value={fmt.currency(totalInterest.toFixed(2), currency)}
              selected={selectedSegment === 'Interest'}
              dimmed={
                selectedSegment !== null && selectedSegment !== 'Interest'
              }
              onClick={() =>
                setSelectedSegment((prev) =>
                  prev === 'Interest' ? null : 'Interest',
                )
              }
            />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-container-lowest px-3 py-2">
            <p className="label-sm normal-case tracking-wide text-on-surface-variant">
              {tCommon('labels.total')}
            </p>
            <p className="font-display text-sm font-bold text-on-surface">
              {fmt.currency(totalLifetimePayment.toFixed(2), currency)}
            </p>
          </div>
          {emi.processingFee && (
            <>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-container-lowest px-3 py-2">
                <p className="label-sm normal-case tracking-wide text-on-surface-variant">
                  {t('detail.processingFee')}
                </p>
                <p className="font-display text-sm font-bold text-on-surface">
                  {fmt.currency(emi.processingFee, currency)}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-container-lowest px-3 py-2">
                <p className="label-sm normal-case tracking-wide text-on-surface-variant">
                  {t('detail.totalCost')}
                </p>
                <p className="font-display text-sm font-bold text-on-surface">
                  {fmt.currency(totalCost.toFixed(2), currency)}
                </p>
              </div>
            </>
          )}
        </section>

        <section className="rounded-3xl bg-surface-container-low p-4">
          <h2 className="label-md mb-3 px-2 text-on-surface-variant">
            {t('detail.amortizationSchedule')}
          </h2>
          <div className="max-h-[32rem] overflow-y-auto pr-1">
            <ul className="space-y-1">
              {payments.map((payment) => {
                const isPaid = payment.status === 'paid'
                const due = new Date(payment.dueDate)
                const isOverdue = !isPaid && due < now
                // The sentinel fee row renders as a non-interactive line: no
                // checkbox toggle, no P/I breakdown, just a labeled amount.
                if (isFeePayment(payment)) {
                  return (
                    <li key={payment.id}>
                      <div className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-lowest/40 px-3 py-3 text-left text-on-surface-variant">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-secondary bg-secondary text-on-secondary">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="body-sm font-semibold">
                              {t('detail.processingFee')}
                            </span>
                            <span className="body-sm">
                              {fmt.date(due, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-on-surface-variant/75">
                            {t('detail.feeOneTime')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-sm font-bold">
                            {fmt.currency(payment.emiAmount, currency)}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                }
                return (
                  <li key={payment.id}>
                    <button
                      type="button"
                      onClick={() =>
                        markPayment.mutate({
                          paymentId: payment.id,
                          paid: !isPaid,
                        })
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition',
                        isPaid
                          ? 'bg-transparent text-on-surface-variant/60'
                          : isOverdue
                            ? 'bg-tertiary-container/15 text-on-surface'
                            : 'hover:bg-surface-container-lowest text-on-surface',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
                          isPaid
                            ? 'border-secondary bg-secondary text-on-secondary'
                            : 'border-outline-variant/50 bg-transparent',
                        )}
                      >
                        {isPaid && (
                          <Check className="h-4 w-4" strokeWidth={3} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'body-sm font-semibold',
                              isPaid && 'line-through',
                            )}
                          >
                            #{payment.paymentNumber}
                          </span>
                          <span className="body-sm">
                            {fmt.date(due, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {isOverdue && (
                            <span className="label-sm rounded-full bg-tertiary-container/30 px-2 py-0.5 text-tertiary-fixed-dim normal-case tracking-wide">
                              {tCommon('labels.overdue')}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex gap-3 text-xs text-on-surface-variant/75">
                          <span>
                            P{' '}
                            {fmt.currency(payment.principalComponent, currency)}
                          </span>
                          <span>
                            I{' '}
                            {fmt.currency(payment.interestComponent, currency)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-display text-sm font-bold',
                            isPaid && 'line-through',
                          )}
                        >
                          {fmt.currency(payment.emiAmount, currency)}
                        </p>
                        <p className="text-[11px] text-on-surface-variant/75">
                          {t('detail.balanceAbbr')}{' '}
                          {fmt.currency(payment.remainingBalance, currency)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {emi.notes && !editing && (
          <section className="rounded-3xl bg-surface-container-low p-5">
            <p className="label-sm mb-2 text-on-surface-variant">
              {tCommon('labels.notes')}
            </p>
            <p className="body-sm whitespace-pre-wrap text-on-surface">
              {emi.notes}
            </p>
          </section>
        )}

        {editing && (
          <Card variant="low">
            <p className="label-sm mb-3 text-on-surface-variant">
              {t('detail.edit')}
            </p>
            <div className="space-y-4">
              <TextField
                id="edit-label"
                label={t('form.labelLabel')}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                autoFocus
              />
              <div>
                <p className="label-sm mb-2 text-on-surface-variant">
                  {tCommon('labels.notesOptional')}
                </p>
                <TextArea
                  id="edit-notes"
                  placeholder={t('form.notesPlaceholder')}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-on-surface transition hover:bg-white/5"
              >
                {tCommon('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={updateEmi.isPending}
                className="flex-1 rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
              >
                {updateEmi.isPending
                  ? tCommon('actions.saving')
                  : tCommon('actions.save')}
              </button>
            </div>
          </Card>
        )}

        <div className="flex flex-col items-start gap-1">
          {!isCompleted && (
            <button
              type="button"
              onClick={() => setConfirmComplete(true)}
              className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-secondary opacity-80 transition hover:opacity-100"
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
              {t('detail.markCompleteAction')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-tertiary opacity-70 transition hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            {t('detail.delete')}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title={t('detail.deleteConfirmTitle')}
        message={t('detail.deleteConfirmBody')}
        confirmLabel={t('detail.deleteConfirm')}
        pendingLabel={t('detail.deletePending')}
        isPending={deleteEmi.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmComplete}
        title={t('detail.completeConfirmTitle')}
        message={t('detail.completeConfirmBody')}
        confirmLabel={t('detail.completeConfirm')}
        pendingLabel={t('detail.completePending')}
        isPending={completeEmi.isPending}
        onConfirm={handleComplete}
        onCancel={() => setConfirmComplete(false)}
      />
    </main>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'tertiary'
}) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <p className="label-sm normal-case tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-1 text-sm font-bold',
          accent === 'tertiary' ? 'text-tertiary' : 'text-on-surface',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function LegendPill({
  color,
  label,
  value,
  selected = false,
  dimmed = false,
  onClick,
}: {
  color: string
  label: string
  value: string
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', color)} />
      <div className="min-w-0 flex-1 text-left">
        <p className="label-sm normal-case tracking-wide text-on-surface-variant">
          {label}
        </p>
        <p className="font-display text-sm font-bold text-on-surface">
          {value}
        </p>
      </div>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          'flex w-full items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 transition-opacity',
          dimmed && 'opacity-40',
        )}
      >
        {content}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2">
      {content}
    </div>
  )
}
