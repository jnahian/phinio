import {
  emiCompleteSchema,
  emiCreateSchema,
  emiIdSchema,
  emiListQuerySchema,
  emiUpdateSchema,
  markPaymentPaidSchema,
} from '@phinio/validators'
import {
  FEE_PAYMENT_NUMBER,
  calculateEmi,
  generateAmortization,
  isFeePayment,
  isRegularPayment,
} from '@phinio/calc'
import { withIdempotency } from '../idempotency.js'
import { diffFields, fmtText, logActivity } from '../activity-log.js'
import { protectedProcedure, router } from '../trpc.js'

export interface SerializedEmiPayment {
  id: string
  emiId: string
  profileId: string
  paymentNumber: number
  dueDate: Date
  emiAmount: string
  principalComponent: string
  interestComponent: string
  remainingBalance: string
  status: string
  paidAt: Date | null
}

export interface SerializedEmi {
  id: string
  profileId: string
  label: string
  type: string
  notes: string | null
  principal: string
  interestRate: string
  tenureMonths: number
  emiAmount: string
  /** One-time processing fee paid at disbursement (null if none). */
  processingFee: string | null
  startDate: Date
  status: string
  createdAt: Date
  payments: Array<SerializedEmiPayment>
}

function serializeEmi(emi: {
  id: string
  profileId: string
  label: string
  type: string
  notes: string | null
  principal: unknown
  interestRate: unknown
  tenureMonths: number
  emiAmount: unknown
  startDate: Date
  status: string
  createdAt: Date
  payments: Array<{
    id: string
    emiId: string
    profileId: string
    paymentNumber: number
    dueDate: Date
    emiAmount: unknown
    principalComponent: unknown
    interestComponent: unknown
    remainingBalance: unknown
    status: string
    paidAt: Date | null
  }>
}): SerializedEmi {
  // The processing fee, when present, is stored as the sentinel fee row
  // (see `FEE_PAYMENT_NUMBER`) so it doesn't require its own column on Emi.
  const feeRow = emi.payments.find(isFeePayment)
  return {
    id: emi.id,
    profileId: emi.profileId,
    label: emi.label,
    type: emi.type,
    notes: emi.notes,
    principal: String(emi.principal),
    interestRate: String(emi.interestRate),
    tenureMonths: emi.tenureMonths,
    emiAmount: String(emi.emiAmount),
    processingFee: feeRow ? String(feeRow.emiAmount) : null,
    startDate: emi.startDate,
    status: emi.status,
    createdAt: emi.createdAt,
    payments: emi.payments.map((p) => ({
      id: p.id,
      emiId: p.emiId,
      profileId: p.profileId,
      paymentNumber: p.paymentNumber,
      dueDate: p.dueDate,
      emiAmount: String(p.emiAmount),
      principalComponent: String(p.principalComponent),
      interestComponent: String(p.interestComponent),
      remainingBalance: String(p.remainingBalance),
      status: p.status,
      paidAt: p.paidAt,
    })),
  }
}

export const emisRouter = router({
  list: protectedProcedure
    .input(emiListQuerySchema)
    .query(async ({ ctx, input }) => {
      const emis = await ctx.prisma.emi.findMany({
        where: {
          profileId: ctx.profileId,
          status: input.status,
          ...(input.type !== 'all' ? { type: input.type } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          payments: {
            select: {
              id: true,
              paymentNumber: true,
              dueDate: true,
              status: true,
              emiAmount: true,
              remainingBalance: true,
            },
            orderBy: { paymentNumber: 'asc' },
          },
        },
      })
      return emis.map((emi) => {
        // Exclude the sentinel fee row from progress and balance derivation —
        // it isn't part of the regular monthly schedule.
        const regularPayments = emi.payments.filter(isRegularPayment)
        const totalPayments = regularPayments.length
        const paidCount = regularPayments.filter((p) => p.status === 'paid').length
        const nextUnpaid = regularPayments.find((p) => p.status !== 'paid')
        // Use the next-unpaid payment's stored `remainingBalance` (principal
        // payoff after that payment) rather than summing remaining emiAmounts —
        // emiAmount includes interest, so summing over-states the liability.
        const remaining = nextUnpaid ? String(nextUnpaid.remainingBalance) : '0.00'
        return {
          id: emi.id,
          label: emi.label,
          type: emi.type,
          principal: String(emi.principal),
          interestRate: String(emi.interestRate),
          tenureMonths: emi.tenureMonths,
          emiAmount: String(emi.emiAmount),
          startDate: emi.startDate,
          status: emi.status,
          createdAt: emi.createdAt,
          totalPayments,
          paidCount,
          nextDueDate: nextUnpaid?.dueDate ?? null,
          remainingBalance: remaining,
        }
      })
    }),

  get: protectedProcedure
    .input(emiIdSchema)
    .query(async ({ ctx, input }) => {
      const emiId = input.emiId
      const emi = await ctx.prisma.emi.findFirst({
        where: { id: emiId, profileId: ctx.profileId },
        include: {
          payments: { orderBy: { paymentNumber: 'asc' } },
        },
      })
      if (!emi) throw new Error('EMI not found')
      return serializeEmi(emi)
    }),

  create: protectedProcedure
    .input(emiCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { emiAmount } = calculateEmi({
        principal: input.principal,
        annualRate: input.interestRate,
        tenureMonths: input.tenureMonths,
        type: input.type,
      })
      const schedule = generateAmortization({
        principal: input.principal,
        annualRate: input.interestRate,
        tenureMonths: input.tenureMonths,
        startDate: new Date(input.startDate),
        type: input.type,
      })

      // If the client supplied per-payment IDs (offline create flow), they must
      // match the schedule length 1:1 so cache and server agree on identity.
      if (
        input.paymentIds !== undefined &&
        input.paymentIds.length !== schedule.length
      ) {
        throw new Error(
          `paymentIds length (${input.paymentIds.length}) must match schedule length (${schedule.length})`,
        )
      }

      // Treat empty / zero / missing the same — only insert a fee row if the
      // value is a positive amount.
      const feeAmount =
        input.processingFee && Number(input.processingFee) > 0
          ? input.processingFee
          : null

      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const created = await tx.emi.create({
          data: {
            // Use the client-supplied id if present. Prisma's @default(uuid())
            // fills in for legacy callers that don't include one.
            ...(input.id ? { id: input.id } : {}),
            profileId: ctx.profileId,
            label: input.label,
            type: input.type,
            principal: input.principal,
            interestRate: input.interestRate,
            tenureMonths: input.tenureMonths,
            emiAmount,
            startDate: new Date(input.startDate),
            notes: input.notes,
          },
        })
        const startDate = new Date(input.startDate)
        const now = new Date()
        await tx.emiPayment.createMany({
          data: [
            // Sentinel paymentNumber=0 row for the one-time processing fee. Marked
            // paid immediately because the fee is settled at disbursement.
            ...(feeAmount
              ? [
                  {
                    ...(input.processingFeeId ? { id: input.processingFeeId } : {}),
                    emiId: created.id,
                    profileId: ctx.profileId,
                    paymentNumber: FEE_PAYMENT_NUMBER,
                    dueDate: startDate,
                    emiAmount: feeAmount,
                    principalComponent: '0',
                    interestComponent: '0',
                    remainingBalance: input.principal,
                    status: 'paid',
                    paidAt: now,
                  },
                ]
              : []),
            ...schedule.map((row, i) => ({
              ...(input.paymentIds ? { id: input.paymentIds[i] } : {}),
              emiId: created.id,
              profileId: ctx.profileId,
              paymentNumber: row.paymentNumber,
              dueDate: row.dueDate,
              emiAmount: row.emiAmount,
              principalComponent: row.principalComponent,
              interestComponent: row.interestComponent,
              remainingBalance: row.remainingBalance,
            })),
          ],
        })
        await logActivity(tx, ctx.profileId, {
          action: 'create',
          entityType: 'emi',
          entityId: created.id,
          entityLabel: created.label,
          summary: `Created EMI '${created.label}' — ${schedule.length} payments scheduled`,
        })

        return {
          id: created.id,
          label: created.label,
          type: created.type,
          emiAmount: String(created.emiAmount),
          processingFee: feeAmount,
        }
      })
    }),

  update: protectedProcedure
    .input(emiUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const before = await tx.emi.findFirst({
          where: { id: input.emiId, profileId: ctx.profileId },
          select: { id: true, label: true, notes: true, updatedAt: true },
        })
        if (!before) throw new Error('EMI not found')

        if (input.expectedUpdatedAt) {
          const expected = new Date(input.expectedUpdatedAt).getTime()
          if (before.updatedAt.getTime() !== expected) {
            return {
              id: before.id,
              updatedAt: before.updatedAt,
              stale: true,
            } as const
          }
        }

        const result = await tx.emi.updateMany({
          where: { id: input.emiId, profileId: ctx.profileId },
          data: { label: input.label, notes: input.notes },
        })
        if (result.count === 0) throw new Error('EMI not found')
        const updated = await tx.emi.findFirstOrThrow({
          where: { id: input.emiId, profileId: ctx.profileId },
          select: { id: true, updatedAt: true },
        })

        const changes = diffFields(
          before,
          { label: input.label, notes: input.notes ?? null },
          [
            { key: 'label', label: 'Label', format: fmtText },
            { key: 'notes', label: 'Notes', format: fmtText },
          ],
        )

        if (changes.length > 0) {
          await logActivity(tx, ctx.profileId, {
            action: 'update',
            entityType: 'emi',
            entityId: input.emiId,
            entityLabel: input.label,
            summary: `Edited EMI '${input.label}'`,
            changes,
          })
        }

        return {
          id: updated.id,
          updatedAt: updated.updatedAt,
          stale: false,
        } as const
      })
    }),

  delete: protectedProcedure
    .input(emiIdSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const existing = await tx.emi.findFirst({
          where: { id: input.emiId, profileId: ctx.profileId },
          select: { id: true, label: true },
        })
        if (!existing) throw new Error('EMI not found')
        await tx.emi.deleteMany({ where: { id: input.emiId, profileId: ctx.profileId } })
        await logActivity(tx, ctx.profileId, {
          action: 'delete',
          entityType: 'emi',
          entityId: null,
          entityLabel: existing.label,
          summary: `Deleted EMI '${existing.label}'`,
        })
        return { id: input.emiId }
      })
    }),

  markPaymentPaid: protectedProcedure
    .input(markPaymentPaidSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const payment = await tx.emiPayment.findFirst({
          where: { id: input.paymentId, profileId: ctx.profileId },
          select: {
            id: true,
            paymentNumber: true,
            emiId: true,
            emi: { select: { label: true, status: true } },
          },
        })
        if (!payment) throw new Error('Payment not found')
        // The sentinel fee row is settled at disbursement and shouldn't be
        // toggled by the schedule UI.
        if (isFeePayment(payment)) {
          throw new Error('Processing fee cannot be modified')
        }
        await tx.emiPayment.updateMany({
          where: { id: input.paymentId, profileId: ctx.profileId },
          data: {
            status: input.paid ? 'paid' : 'upcoming',
            paidAt: input.paid ? new Date() : null,
          },
        })
        const verb = input.paid ? 'paid' : 'unpaid'
        await logActivity(tx, ctx.profileId, {
          action: 'update',
          entityType: 'emi_payment',
          entityId: payment.id,
          entityLabel: payment.emi.label,
          summary: `Marked payment #${payment.paymentNumber} of '${payment.emi.label}' as ${verb}`,
        })

        // Auto-complete the EMI when the last regular installment is paid, and
        // flip back to active if a previously-completing payment is unmarked.
        const remainingUnpaid = await tx.emiPayment.count({
          where: {
            emiId: payment.emiId,
            profileId: ctx.profileId,
            paymentNumber: { gt: FEE_PAYMENT_NUMBER },
            status: { not: 'paid' },
          },
        })
        const desiredStatus = remainingUnpaid === 0 ? 'completed' : 'active'
        let autoCompleted = false
        if (desiredStatus !== payment.emi.status) {
          await tx.emi.updateMany({
            where: { id: payment.emiId, profileId: ctx.profileId },
            data: { status: desiredStatus },
          })
          if (desiredStatus === 'completed') {
            autoCompleted = true
            await logActivity(tx, ctx.profileId, {
              action: 'update',
              entityType: 'emi',
              entityId: payment.emiId,
              entityLabel: payment.emi.label,
              summary: `Completed EMI '${payment.emi.label}' — all installments paid`,
            })
          } else {
            await logActivity(tx, ctx.profileId, {
              action: 'update',
              entityType: 'emi',
              entityId: payment.emiId,
              entityLabel: payment.emi.label,
              summary: `Reopened EMI '${payment.emi.label}'`,
            })
          }
        }

        return { id: input.paymentId, paid: input.paid, autoCompleted }
      })
    }),

  complete: protectedProcedure
    .input(emiCompleteSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const emi = await tx.emi.findFirst({
          where: { id: input.emiId, profileId: ctx.profileId },
          select: { id: true, label: true, status: true },
        })
        if (!emi) throw new Error('EMI not found')
        if (emi.status === 'completed') {
          return { id: emi.id, alreadyCompleted: true }
        }

        const now = new Date()
        const result = await tx.emiPayment.updateMany({
          where: {
            emiId: emi.id,
            profileId: ctx.profileId,
            paymentNumber: { gt: FEE_PAYMENT_NUMBER },
            status: { not: 'paid' },
          },
          data: { status: 'paid', paidAt: now },
        })
        await tx.emi.updateMany({
          where: { id: emi.id, profileId: ctx.profileId },
          data: { status: 'completed' },
        })

        const tail =
          result.count > 0
            ? `marked ${result.count} remaining installment${result.count === 1 ? '' : 's'} as paid`
            : 'all installments already paid'
        await logActivity(tx, ctx.profileId, {
          action: 'update',
          entityType: 'emi',
          entityId: emi.id,
          entityLabel: emi.label,
          summary: `Completed EMI '${emi.label}' — ${tail}`,
        })

        return { id: emi.id, alreadyCompleted: false }
      })
    }),

  upcomingPayments: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const rows = await ctx.prisma.emiPayment.findMany({
      where: {
        profileId: ctx.profileId,
        status: { not: 'paid' },
        dueDate: { lte: in30Days },
        // Defensively exclude the sentinel fee row, even though `status` already
        // filters it out today — the invariant is worth pinning at the query.
        paymentNumber: { gt: FEE_PAYMENT_NUMBER },
      },
      include: { emi: { select: { id: true, label: true, type: true } } },
      orderBy: { dueDate: 'asc' },
      take: 5,
    })
    return rows.map((p) => ({
      id: p.id,
      emiId: p.emiId,
      emiLabel: p.emi.label,
      emiType: p.emi.type,
      paymentNumber: p.paymentNumber,
      dueDate: p.dueDate,
      emiAmount: String(p.emiAmount),
      isOverdue: p.dueDate < now,
    }))
  }),
})
