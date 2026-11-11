import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { ActionMenu } from '#/components/ui/ActionMenu'
import type { ActionMenuItem } from '#/components/ui/ActionMenu'
import { Card } from '#/components/ui/Card'
import { ConfirmModal } from '#/components/ui/ConfirmModal'
import { ProgressBar } from '#/components/ui/ProgressBar'
import { TextArea, TextField } from '#/components/ui/TextField'
import { getCurrencySymbol } from '#/lib/currency'
import { useFormatter } from '#/lib/i18n/useFormatter'
import { useSetTopBarTitle } from '#/lib/top-bar-context'
import {
  addLoanRepaymentSchema,
  personalLoanUpdateSchema,
} from '#/lib/validators'
import {
  useAddLoanRepayment,
  useDeletePersonalLoan,
  usePersonalLoanQuery,
  useRemoveLoanRepayment,
  useUpdatePersonalLoan,
} from '#/hooks/usePersonalLoans'

export const Route = createFileRoute('/app/emis/personal/$loanId')({
  staticData: { hideTabBar: true, backTo: '/app/emis/personal' },
  component: PersonalLoanDetailScreen,
})

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Stored dates are UTC midnight (`@db.Date`); read them back as UTC so the
// edit form shows the same calendar day.
function toIsoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10)
}

function firstErrors(
  issues: Array<{ path: Array<PropertyKey>; message: string }>,
) {
  const errs: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !errs[key]) errs[key] = issue.message
  }
  return errs
}

function PersonalLoanDetailScreen() {
  const { t } = useTranslation('emis')
  const { t: tCommon } = useTranslation('common')
  const { loanId } = Route.useParams()
  const navigate = useNavigate()
  const { profile } = Route.useRouteContext()
  const currency = profile.preferredCurrency
  const symbol = getCurrencySymbol(currency)
  const fmt = useFormatter()

  const { data: loan, isLoading } = usePersonalLoanQuery(loanId)
  useSetTopBarTitle(loan?.counterparty ?? null)
  const updateLoan = useUpdatePersonalLoan()
  const deleteLoan = useDeletePersonalLoan()
  const addRepayment = useAddLoanRepayment()
  const removeRepayment = useRemoveLoanRepayment()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)

  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayIso())
  const [payNotes, setPayNotes] = useState('')
  const [payErrors, setPayErrors] = useState<Record<string, string>>({})

  const [editCounterparty, setEditCounterparty] = useState('')
  const [editPrincipal, setEditPrincipal] = useState('')
  const [editTotal, setEditTotal] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})

  if (!loan) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-on-surface-variant">
        {isLoading
          ? tCommon('actions.loading')
          : t('personal.detail.loadFailed')}
      </main>
    )
  }

  const isBorrowed = loan.direction === 'borrowed'
  const isSettled = loan.status === 'settled'
  const total = Number(loan.totalDue)
  const repaid = Number(loan.repaid)

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault()
    setPayErrors({})
    const parsed = addLoanRepaymentSchema.safeParse({
      loanId,
      amount: payAmount,
      paidAt: payDate,
      notes: payNotes.trim() || undefined,
    })
    if (!parsed.success) {
      setPayErrors(firstErrors(parsed.error.issues))
      return
    }
    // The server rejects this too; checking here keeps it from surfacing as
    // a failed sync.
    if (!loan) return
    if (Number(parsed.data.amount) > Number(loan.outstanding)) {
      setPayErrors({
        amount: t('personal.detail.overpay', {
          amount: fmt.currency(loan.outstanding, currency),
        }),
      })
      return
    }
    try {
      await addRepayment.mutateAsync(parsed.data)
      setPayAmount('')
      setPayNotes('')
      setPayDate(todayIso())
      setShowPaymentForm(false)
    } catch {
      // handled in hook
    }
  }

  function openEdit() {
    if (!loan) return
    setEditCounterparty(loan.counterparty)
    setEditPrincipal(loan.principal)
    setEditTotal(loan.totalRepayable ?? '')
    setEditDate(toIsoDate(loan.startDate))
    setEditNotes(loan.notes ?? '')
    setEditErrors({})
    setShowEditForm(true)
  }

  async function handleEditSave() {
    setEditErrors({})
    const parsed = personalLoanUpdateSchema.safeParse({
      loanId,
      counterparty: editCounterparty,
      principal: editPrincipal,
      totalRepayable: editTotal.trim() || undefined,
      startDate: editDate,
      notes: editNotes.trim() || undefined,
    })
    if (!parsed.success) {
      setEditErrors(firstErrors(parsed.error.issues))
      return
    }
    // Mirrors the server check, so it isn't reported as a failed sync.
    if (!loan) return
    const { totalRepayable, principal } = parsed.data
    if (Number(totalRepayable ?? principal) < Number(loan.repaid)) {
      setEditErrors({
        [totalRepayable ? 'totalRepayable' : 'principal']: t(
          'personal.detail.belowRepaid',
          { amount: fmt.currency(loan.repaid, currency) },
        ),
      })
      return
    }
    try {
      await updateLoan.mutateAsync(parsed.data)
      setShowEditForm(false)
    } catch {
      // handled in hook
    }
  }

  async function handleDelete() {
    try {
      await deleteLoan.mutateAsync({ loanId })
      navigate({ to: '/app/emis/personal' })
    } catch {
      // handled in hook
    }
  }

  async function handleRemovePayment(repaymentId: string) {
    try {
      await removeRepayment.mutateAsync({ repaymentId })
      setConfirmRemoveId(null)
    } catch {
      // handled in hook
    }
  }

  const formatDate = (d: Date | string) =>
    fmt.date(d, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <main className="noir-bg min-h-dvh pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="space-y-6 px-5 pt-4">
        <div className="flex items-center justify-between">
          <p className="body-sm text-on-surface-variant">
            {isBorrowed
              ? t('personal.detail.borrowedFrom')
              : t('personal.detail.lentTo')}
          </p>
          <ActionMenu
            ariaLabel={tCommon('ariaLabels.moreActions')}
            items={
              [
                {
                  key: 'edit',
                  label: t('personal.detail.edit'),
                  icon: <Pencil className="h-4 w-4" strokeWidth={1.75} />,
                  onSelect: openEdit,
                },
                {
                  key: 'delete',
                  label: t('personal.detail.delete'),
                  icon: <Trash2 className="h-4 w-4" strokeWidth={1.75} />,
                  variant: 'danger',
                  onSelect: () => setConfirmDelete(true),
                },
              ] satisfies Array<ActionMenuItem>
            }
          />
        </div>

        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-container to-[#1e3a8a] p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10"
          />
          <p className="label-sm text-white/70">
            {isSettled
              ? t('personal.detail.settled')
              : isBorrowed
                ? t('personal.detail.youOwe')
                : t('personal.detail.owedToYou')}
          </p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-white">
            {fmt.currency(loan.outstanding, currency)}
          </p>
          <div className="relative mt-4 space-y-2">
            <ProgressBar
              value={repaid}
              max={total || 1}
              className="bg-white/15"
              indicatorClassName="bg-white"
            />
            <p className="body-sm text-white/80">
              {t('personal.list.paidOf', {
                paid: fmt.currency(loan.repaid, currency),
                total: fmt.currency(loan.totalDue, currency),
              })}{' '}
              {isBorrowed
                ? t('personal.detail.repaid')
                : t('personal.detail.received')}
            </p>
          </div>
          {!isSettled && !showPaymentForm && (
            <button
              type="button"
              onClick={() => setShowPaymentForm(true)}
              className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              {isBorrowed
                ? t('personal.detail.logRepayment')
                : t('personal.detail.logReceived')}
            </button>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3">
          <StatTile
            label={t('personal.detail.principal')}
            value={fmt.currency(loan.principal, currency)}
          />
          {loan.totalRepayable ? (
            <StatTile
              label={t('personal.detail.agreedTotal')}
              value={fmt.currency(loan.totalRepayable, currency)}
            />
          ) : (
            <StatTile
              label={t('personal.detail.date')}
              value={formatDate(loan.startDate)}
            />
          )}
        </section>

        {/* Log a payment */}
        {showPaymentForm && (
          <Card variant="low">
            <div className="mb-3 flex items-center justify-between">
              <p className="label-sm text-on-surface-variant">
                {isBorrowed
                  ? t('personal.detail.logRepayment')
                  : t('personal.detail.logReceived')}
              </p>
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                className="text-on-surface-variant/60 hover:text-on-surface"
                aria-label={tCommon('actions.cancel')}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={handleAddPayment} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="payAmount"
                  label={tCommon('labels.amount')}
                  placeholder="0.00"
                  inputMode="decimal"
                  prefix={symbol}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  error={payErrors.amount}
                  autoFocus
                />
                <TextField
                  id="payDate"
                  label={tCommon('labels.date')}
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  error={payErrors.paidAt}
                />
              </div>
              <button
                type="button"
                onClick={() => setPayAmount(loan.outstanding)}
                className="rounded-full bg-surface-container-highest px-3 py-1 text-xs font-semibold text-on-surface transition hover:bg-surface-bright"
              >
                {t('personal.detail.fullRemaining')} ·{' '}
                {fmt.currency(loan.outstanding, currency)}
              </button>
              <TextField
                id="payNotes"
                label={tCommon('labels.notesOptional')}
                placeholder={t('personal.detail.paymentNotesPlaceholder')}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
              <button
                type="submit"
                disabled={addRepayment.isPending}
                className="w-full rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
              >
                {addRepayment.isPending
                  ? tCommon('actions.saving')
                  : t('personal.detail.logSubmit')}
              </button>
            </form>
          </Card>
        )}

        {/* Payment history */}
        <section className="rounded-3xl bg-surface-container-low p-4">
          <h2 className="label-md mb-3 px-2 text-on-surface-variant">
            {t('personal.detail.payments')}
          </h2>
          {loan.repayments.length === 0 ? (
            <p className="body-sm px-2 pb-2 text-on-surface-variant/70">
              {t('personal.detail.noPayments')}
            </p>
          ) : (
            <ul className="space-y-1">
              {loan.repayments.map((r) => (
                <li key={r.id}>
                  <div className="flex w-full items-center gap-3 rounded-2xl px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="body-sm text-on-surface">
                        {formatDate(r.paidAt)}
                      </p>
                      {r.notes && (
                        <p className="mt-0.5 text-xs text-on-surface-variant/70">
                          {r.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-sm font-bold text-on-surface">
                        {fmt.currency(r.amount, currency)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(r.id)}
                        className="text-on-surface-variant/40 transition hover:text-tertiary"
                        aria-label={t('personal.detail.removePayment')}
                      >
                        <X className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {loan.notes && (
          <Card variant="low">
            <p className="label-sm mb-2 text-on-surface-variant">
              {tCommon('labels.notes')}
            </p>
            <p className="body-md whitespace-pre-wrap text-on-surface">
              {loan.notes}
            </p>
          </Card>
        )}

        {/* Edit */}
        {showEditForm && (
          <Card variant="low">
            <p className="label-sm mb-3 text-on-surface-variant">
              {t('personal.detail.edit')}
            </p>
            <div className="space-y-4">
              <TextField
                id="edit-counterparty"
                label={
                  isBorrowed
                    ? t('personal.form.counterpartyBorrowed')
                    : t('personal.form.counterpartyLent')
                }
                value={editCounterparty}
                onChange={(e) => setEditCounterparty(e.target.value)}
                error={editErrors.counterparty}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="edit-principal"
                  label={t('personal.form.principalLabel')}
                  inputMode="decimal"
                  prefix={symbol}
                  value={editPrincipal}
                  onChange={(e) => setEditPrincipal(e.target.value)}
                  error={editErrors.principal}
                />
                <TextField
                  id="edit-date"
                  label={tCommon('labels.date')}
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  error={editErrors.startDate}
                />
              </div>
              <TextField
                id="edit-total"
                label={t('personal.form.totalLabel')}
                placeholder="0.00"
                inputMode="decimal"
                prefix={symbol}
                value={editTotal}
                onChange={(e) => setEditTotal(e.target.value)}
                error={editErrors.totalRepayable}
              />
              <div>
                <p className="label-sm mb-2 text-on-surface-variant">
                  {tCommon('labels.notesOptional')}
                </p>
                <TextArea
                  id="edit-notes"
                  placeholder={t('personal.form.notesPlaceholder')}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditForm(false)}
                className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-on-surface transition hover:bg-white/5"
              >
                {tCommon('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={updateLoan.isPending}
                className="flex-1 rounded-xl bg-primary-container px-4 py-3 font-semibold text-on-primary-container disabled:opacity-60"
              >
                {updateLoan.isPending
                  ? tCommon('actions.saving')
                  : tCommon('actions.save')}
              </button>
            </div>
          </Card>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete}
        title={t('personal.detail.deleteConfirmTitle')}
        message={t('personal.detail.deleteConfirmBody', {
          name: loan.counterparty,
        })}
        confirmLabel={t('personal.detail.deleteConfirm')}
        pendingLabel={t('personal.detail.deletePending')}
        isPending={deleteLoan.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmRemoveId !== null}
        title={t('personal.detail.removeTitle')}
        message={t('personal.detail.removeBody')}
        confirmLabel={t('personal.detail.removeConfirm')}
        pendingLabel={t('personal.detail.removePending')}
        isPending={removeRepayment.isPending}
        onConfirm={() =>
          confirmRemoveId && handleRemovePayment(confirmRemoveId)
        }
        onCancel={() => setConfirmRemoveId(null)}
      />
    </main>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low p-4">
      <p className="label-sm normal-case tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="font-display mt-1 text-sm font-bold text-on-surface">
        {value}
      </p>
    </div>
  )
}
