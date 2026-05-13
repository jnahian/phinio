import { Prisma } from '@phinio/db'
import {
  addDepositSchema,
  dpsCloseSchema,
  dpsCreateSchema,
  dpsUpdateSchema,
  investmentCreateSchema,
  investmentIdSchema,
  investmentListQuerySchema,
  investmentUpdateSchema,
  markDepositPaidSchema,
  removeDepositSchema,
  savingsCreateSchema,
  savingsUpdateSchema,
  withdrawalSchema,
} from '@phinio/validators'
import { generateDpsSchedule } from '@phinio/calc'
import { withIdempotency } from '../idempotency.js'
import {
  diffFields,
  fmtDate,
  fmtText,
  getProfileCurrency,
  logActivity,
} from '../activity-log.js'
import { formatCurrency } from '../format-currency.js'
import { protectedProcedure, router } from '../trpc.js'

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

function dec(v: unknown): string {
  return String(v)
}

function decOrNull(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v)
}

// ---------------------------------------------------------------------------
// List — unified across all three modes
// ---------------------------------------------------------------------------

export interface InvestmentListItem {
  id: string
  name: string
  type: string
  mode: string
  status: string
  notes: string | null
  createdAt: Date
  // lump_sum
  investedAmount: string
  currentValue: string
  exitValue: string | null
  totalWithdrawn: string
  dateOfInvestment: Date | null
  // scheduled (DPS)
  monthlyDeposit: string | null
  tenureMonths: number | null
  interestRate: string | null
  interestType: string | null
  startDate: Date | null
  paidCount: number
  maturityValue: string | null
  nextDueDate: Date | null
}

// ---------------------------------------------------------------------------
// Detail — includes full deposit list
// ---------------------------------------------------------------------------

export interface DepositItem {
  id: string
  investmentId: string
  amount: string
  dueDate: Date | null
  paidAt: Date | null
  accruedValue: string | null
  installmentNumber: number | null
  status: string
  notes: string | null
  createdAt: Date
}

export interface WithdrawalItem {
  id: string
  investmentId: string
  amount: string
  withdrawalDate: Date
  notes: string | null
  createdAt: Date
}

export interface InvestmentDetail {
  id: string
  profileId: string
  name: string
  type: string
  mode: string
  status: string
  notes: string | null
  createdAt: Date
  investedAmount: string
  currentValue: string
  exitValue: string | null
  dateOfInvestment: Date | null
  completedAt: Date | null
  monthlyDeposit: string | null
  tenureMonths: number | null
  interestRate: string | null
  interestType: string | null
  startDate: Date | null
  deposits: DepositItem[]
  withdrawals: WithdrawalItem[]
}

export const investmentsRouter = router({
  list: protectedProcedure
    .input(investmentListQuerySchema)
    .query(async ({ ctx, input }): Promise<InvestmentListItem[]> => {
      const statusFilter =
        input.status === 'active' ? ['active'] : ['completed', 'matured', 'closed']

      const typeFilter =
        input.type === 'all'
          ? undefined
          : input.type === 'dps'
            ? 'dps'
            : input.type === 'savings'
              ? 'savings'
              : input.type

      const rows = await ctx.prisma.investment.findMany({
        where: {
          profileId: ctx.profileId,
          status: { in: statusFilter },
          ...(typeFilter !== undefined ? { type: typeFilter } : {}),
        },
        include: {
          deposits: {
            select: {
              installmentNumber: true,
              dueDate: true,
              accruedValue: true,
              status: true,
            },
            orderBy: { installmentNumber: 'asc' },
          },
          withdrawals: { select: { amount: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      return rows.map((row) => {
        const paidDeposits = row.deposits.filter((d) => d.status === 'paid')
        const paidCount = paidDeposits.length
        const lastDeposit = row.deposits.at(-1)
        const maturityValue =
          row.mode === 'scheduled' && lastDeposit?.accruedValue
            ? dec(lastDeposit.accruedValue)
            : null
        const nextUnpaid = row.deposits.find((d) => d.status !== 'paid')
        const nextDueDate =
          row.mode === 'scheduled' ? (nextUnpaid?.dueDate ?? null) : null
        const totalWithdrawn = row.withdrawals
          .reduce((sum, w) => sum + Number(w.amount), 0)
          .toFixed(2)

        return {
          id: row.id,
          name: row.name,
          type: row.type,
          mode: row.mode,
          status: row.status,
          notes: row.notes,
          createdAt: row.createdAt,
          investedAmount: dec(row.investedAmount),
          currentValue: dec(row.currentValue),
          exitValue: decOrNull(row.exitValue),
          totalWithdrawn,
          dateOfInvestment: row.dateOfInvestment,
          monthlyDeposit: decOrNull(row.monthlyDeposit),
          tenureMonths: row.tenureMonths,
          interestRate: decOrNull(row.interestRate),
          interestType: row.interestType,
          startDate: row.startDate,
          paidCount,
          maturityValue,
          nextDueDate,
        }
      })
    }),

  get: protectedProcedure
    .input(investmentIdSchema)
    .query(async ({ ctx, input }): Promise<InvestmentDetail> => {
      const row = await ctx.prisma.investment.findFirst({
        where: { id: input.id, profileId: ctx.profileId },
        include: {
          deposits: { orderBy: { installmentNumber: 'asc' } },
          withdrawals: { orderBy: { withdrawalDate: 'desc' } },
        },
      })
      if (!row) throw new Error('Investment not found')
      return {
        id: row.id,
        profileId: row.profileId,
        name: row.name,
        type: row.type,
        mode: row.mode,
        status: row.status,
        notes: row.notes,
        createdAt: row.createdAt,
        investedAmount: dec(row.investedAmount),
        currentValue: dec(row.currentValue),
        exitValue: decOrNull(row.exitValue),
        dateOfInvestment: row.dateOfInvestment,
        completedAt: row.completedAt,
        monthlyDeposit: decOrNull(row.monthlyDeposit),
        tenureMonths: row.tenureMonths,
        interestRate: decOrNull(row.interestRate),
        interestType: row.interestType,
        startDate: row.startDate,
        deposits: row.deposits.map((d) => ({
          id: d.id,
          investmentId: d.investmentId,
          amount: dec(d.amount),
          dueDate: d.dueDate,
          paidAt: d.paidAt,
          accruedValue: decOrNull(d.accruedValue),
          installmentNumber: d.installmentNumber,
          status: d.status,
          notes: d.notes,
          createdAt: d.createdAt,
        })),
        withdrawals: row.withdrawals.map((w) => ({
          id: w.id,
          investmentId: w.investmentId,
          amount: dec(w.amount),
          withdrawalDate: w.withdrawalDate,
          notes: w.notes,
          createdAt: w.createdAt,
        })),
      }
    }),

  create: protectedProcedure
    .input(investmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const created = await tx.investment.create({
          data: {
            ...(input.id ? { id: input.id } : {}),
            profileId: ctx.profileId,
            name: input.name,
            type: input.type,
            mode: 'lump_sum',
            investedAmount: input.investedAmount,
            currentValue: input.currentValue,
            dateOfInvestment: new Date(input.dateOfInvestment),
            notes: input.notes,
          },
        })
        await logActivity(tx, ctx.profileId, {
          action: 'create',
          entityType: 'investment',
          entityId: created.id,
          entityLabel: created.name,
          summary: `Created investment '${created.name}'`,
        })
        return { id: created.id }
      })
    }),

  update: protectedProcedure
    .input(investmentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const before = await tx.investment.findFirst({
          where: { id: input.id, profileId: ctx.profileId },
        })
        if (!before) throw new Error('Investment not found')
        const currency = await getProfileCurrency(tx, ctx.profileId)

        // Last-write-wins: if the client tells us what `updatedAt` it last saw
        // and the server has moved on, return the current row so the client can
        // reconcile its cache and toast "your edit was overwritten" without
        // applying the stale write.
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

        const nextExitValue =
          input.status === 'completed' && input.exitValue ? input.exitValue : null
        const nextCompletedAt =
          input.status === 'completed' && input.completedAt
            ? new Date(input.completedAt)
            : null

        // Scope the write itself by profileId so authorization lives in the
        // WHERE clause, not in the prior findFirst. updateMany returns a count
        // — refetch updatedAt for the LWW envelope.
        const result = await tx.investment.updateMany({
          where: { id: input.id, profileId: ctx.profileId },
          data: {
            name: input.name,
            type: input.type,
            investedAmount: input.investedAmount,
            currentValue: input.currentValue,
            dateOfInvestment: new Date(input.dateOfInvestment),
            notes: input.notes,
            status: input.status,
            exitValue: nextExitValue,
            completedAt: nextCompletedAt,
          },
        })
        if (result.count === 0) throw new Error('Investment not found')
        const updated = await tx.investment.findFirstOrThrow({
          where: { id: input.id, profileId: ctx.profileId },
          select: { id: true, updatedAt: true },
        })

        const changes = diffFields(
          before,
          {
            name: input.name,
            type: input.type,
            investedAmount: input.investedAmount,
            currentValue: input.currentValue,
            dateOfInvestment: new Date(input.dateOfInvestment),
            notes: input.notes ?? null,
            status: input.status,
            exitValue: nextExitValue,
            completedAt: nextCompletedAt,
          },
          [
            { key: 'name', label: 'Name', format: fmtText },
            { key: 'type', label: 'Type', format: fmtText },
            { key: 'investedAmount', label: 'Invested amount', isMoney: true },
            { key: 'currentValue', label: 'Current value', isMoney: true },
            { key: 'dateOfInvestment', label: 'Date', format: fmtDate },
            { key: 'notes', label: 'Notes', format: fmtText },
            { key: 'status', label: 'Status', format: fmtText },
            { key: 'exitValue', label: 'Exit value', isMoney: true },
            { key: 'completedAt', label: 'Completed on', format: fmtDate },
          ],
          currency,
        )

        if (changes.length > 0) {
          const summary =
            input.status === 'completed' && before.status !== 'completed'
              ? `Marked investment '${input.name}' as completed`
              : `Edited investment '${input.name}'`

          await logActivity(tx, ctx.profileId, {
            action: 'update',
            entityType: 'investment',
            entityId: input.id,
            entityLabel: input.name,
            summary,
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
    .input(investmentIdSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const existing = await tx.investment.findFirst({
          where: { id: input.id, profileId: ctx.profileId },
          select: { id: true, name: true, mode: true },
        })
        if (!existing) throw new Error('Investment not found')
        await tx.investment.deleteMany({ where: { id: input.id, profileId: ctx.profileId } })
        const label =
          existing.mode === 'flexible'
            ? `savings pot '${existing.name}'`
            : existing.mode === 'scheduled'
              ? `DPS '${existing.name}'`
              : `investment '${existing.name}'`
        await logActivity(tx, ctx.profileId, {
          action: 'delete',
          entityType: 'investment',
          entityId: null,
          entityLabel: existing.name,
          summary: `Deleted ${label}`,
        })
        return { id: input.id }
      })
    }),

  createDps: protectedProcedure
    .input(dpsCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const schedule = generateDpsSchedule({
        monthlyDeposit: input.monthlyDeposit,
        tenureMonths: input.tenureMonths,
        annualRate: input.interestRate,
        interestType: input.interestType,
        startDate: new Date(input.startDate),
      })

      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const inv = await tx.investment.create({
          data: {
            ...(input.id ? { id: input.id } : {}),
            profileId: ctx.profileId,
            name: input.name,
            type: 'dps',
            mode: 'scheduled',
            investedAmount: 0,
            currentValue: 0,
            monthlyDeposit: input.monthlyDeposit,
            tenureMonths: input.tenureMonths,
            interestRate: input.interestRate,
            interestType: input.interestType,
            startDate: new Date(input.startDate),
            notes: input.notes,
          },
        })
        await tx.investmentDeposit.createMany({
          data: schedule.map((s) => ({
            investmentId: inv.id,
            profileId: ctx.profileId,
            installmentNumber: s.installmentNumber,
            dueDate: s.dueDate,
            amount: s.depositAmount,
            accruedValue: s.accruedValue,
            status: 'upcoming',
          })),
        })
        await logActivity(tx, ctx.profileId, {
          action: 'create',
          entityType: 'investment',
          entityId: inv.id,
          entityLabel: inv.name,
          summary: `Created DPS '${inv.name}' — ${schedule.length} installments scheduled`,
        })
        return { id: inv.id, name: inv.name }
      })
    }),

  updateDps: protectedProcedure
    .input(dpsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const before = await tx.investment.findFirst({
          where: { id: input.id, profileId: ctx.profileId, mode: 'scheduled' },
          select: { id: true, name: true, notes: true, updatedAt: true },
        })
        if (!before) throw new Error('DPS not found')

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

        const result = await tx.investment.updateMany({
          where: { id: input.id, profileId: ctx.profileId, mode: 'scheduled' },
          data: { name: input.name, notes: input.notes },
        })
        if (result.count === 0) throw new Error('DPS not found')
        const updated = await tx.investment.findFirstOrThrow({
          where: { id: input.id, profileId: ctx.profileId },
          select: { id: true, updatedAt: true },
        })

        const changes = diffFields(
          before,
          { name: input.name, notes: input.notes ?? null },
          [
            { key: 'name', label: 'Name', format: fmtText },
            { key: 'notes', label: 'Notes', format: fmtText },
          ],
        )

        if (changes.length > 0) {
          await logActivity(tx, ctx.profileId, {
            action: 'update',
            entityType: 'investment',
            entityId: input.id,
            entityLabel: input.name,
            summary: `Edited DPS '${input.name}'`,
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

  markDepositPaid: protectedProcedure
    .input(markDepositPaidSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const deposit = await tx.investmentDeposit.findFirst({
          where: { id: input.depositId, profileId: ctx.profileId },
          select: {
            id: true,
            investmentId: true,
            installmentNumber: true,
            amount: true,
            investment: { select: { name: true } },
          },
        })
        if (!deposit) throw new Error('Deposit not found')

        await tx.investmentDeposit.updateMany({
          where: { id: input.depositId, profileId: ctx.profileId },
          data: {
            status: input.paid ? 'paid' : 'upcoming',
            paidAt: input.paid ? new Date() : null,
          },
        })

        // Sync investedAmount + currentValue = sum of paid deposits
        const paidDeposits = await tx.investmentDeposit.findMany({
          where: { investmentId: deposit.investmentId, status: 'paid' },
          select: { amount: true },
        })
        const totalPaid = paidDeposits.reduce((sum, d) => sum + Number(d.amount), 0)
        await tx.investment.updateMany({
          where: { id: deposit.investmentId, profileId: ctx.profileId },
          data: {
            investedAmount: totalPaid.toFixed(2),
            currentValue: totalPaid.toFixed(2),
          },
        })

        let autoMatured = false
        let reactivated = false
        if (input.paid) {
          const unpaidCount = await tx.investmentDeposit.count({
            where: { investmentId: deposit.investmentId, status: { not: 'paid' } },
          })
          if (unpaidCount === 0) {
            await tx.investment.updateMany({
              where: { id: deposit.investmentId, profileId: ctx.profileId },
              data: { status: 'matured' },
            })
            autoMatured = true
          }
        } else {
          // Unmarking after auto-maturity leaves unpaid installments behind; roll
          // the status back to active so the DPS is consistent with its deposits.
          const res = await tx.investment.updateMany({
            where: {
              id: deposit.investmentId,
              profileId: ctx.profileId,
              status: 'matured',
            },
            data: { status: 'active' },
          })
          reactivated = res.count > 0
        }

        const depositTarget = deposit.installmentNumber
          ? `installment #${deposit.installmentNumber} of '${deposit.investment.name}'`
          : `'${deposit.investment.name}'`
        const summary = input.paid
          ? `Marked ${depositTarget} as paid`
          : `Unmarked ${depositTarget} as paid`

        await logActivity(tx, ctx.profileId, {
          action: 'update',
          entityType: 'investment_deposit',
          entityId: deposit.id,
          entityLabel: deposit.investment.name,
          summary,
        })

        if (autoMatured) {
          await logActivity(tx, ctx.profileId, {
            action: 'update',
            entityType: 'investment',
            entityId: deposit.investmentId,
            entityLabel: deposit.investment.name,
            summary: `DPS '${deposit.investment.name}' matured — all installments paid`,
          })
        }

        if (reactivated) {
          await logActivity(tx, ctx.profileId, {
            action: 'update',
            entityType: 'investment',
            entityId: deposit.investmentId,
            entityLabel: deposit.investment.name,
            summary: `DPS '${deposit.investment.name}' reactivated — installment unmarked`,
          })
        }

        return { id: input.depositId, paid: input.paid }
      })
    }),

  createSavings: protectedProcedure
    .input(savingsCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const initialAmount = Number(input.currentValue)

      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const created = await tx.investment.create({
          data: {
            ...(input.id ? { id: input.id } : {}),
            profileId: ctx.profileId,
            name: input.name,
            type: 'savings',
            mode: 'flexible',
            investedAmount: initialAmount > 0 ? input.currentValue : 0,
            currentValue: input.currentValue,
            startDate: new Date(input.startDate),
            notes: input.notes,
          },
        })

        if (initialAmount > 0) {
          await tx.investmentDeposit.create({
            data: {
              investmentId: created.id,
              profileId: ctx.profileId,
              amount: input.currentValue,
              dueDate: new Date(input.startDate),
              paidAt: new Date(input.startDate),
              status: 'paid',
              notes: 'Initial deposit',
            },
          })
        }

        await logActivity(tx, ctx.profileId, {
          action: 'create',
          entityType: 'investment',
          entityId: created.id,
          entityLabel: created.name,
          summary: `Created savings pot '${created.name}'`,
        })

        return { id: created.id, name: created.name }
      })
    }),

  updateSavings: protectedProcedure
    .input(savingsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const before = await tx.investment.findFirst({
          where: { id: input.id, profileId: ctx.profileId, mode: 'flexible' },
          select: {
            id: true,
            name: true,
            currentValue: true,
            notes: true,
            updatedAt: true,
          },
        })
        if (!before) throw new Error('Savings pot not found')
        const currency = await getProfileCurrency(tx, ctx.profileId)

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

        const result = await tx.investment.updateMany({
          where: { id: input.id, profileId: ctx.profileId },
          data: {
            name: input.name,
            currentValue: input.currentValue,
            notes: input.notes,
          },
        })
        if (result.count === 0) throw new Error('Savings pot not found')
        const updated = await tx.investment.findFirstOrThrow({
          where: { id: input.id, profileId: ctx.profileId },
          select: { id: true, updatedAt: true },
        })

        const changes = diffFields(
          before,
          {
            name: input.name,
            currentValue: input.currentValue,
            notes: input.notes ?? null,
          },
          [
            { key: 'name', label: 'Name', format: fmtText },
            { key: 'currentValue', label: 'Current value', isMoney: true },
            { key: 'notes', label: 'Notes', format: fmtText },
          ],
          currency,
        )

        if (changes.length > 0) {
          await logActivity(tx, ctx.profileId, {
            action: 'update',
            entityType: 'investment',
            entityId: input.id,
            entityLabel: input.name,
            summary: `Edited savings pot '${input.name}'`,
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

  deleteSavings: protectedProcedure
    .input(investmentIdSchema)
    .mutation(async ({ ctx, input }) => {
      // Same body as `delete` — separate procedure preserves the existing API
      // surface for the savings-pot deletion flow.
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const existing = await tx.investment.findFirst({
          where: { id: input.id, profileId: ctx.profileId },
          select: { id: true, name: true, mode: true },
        })
        if (!existing) throw new Error('Investment not found')
        await tx.investment.deleteMany({ where: { id: input.id, profileId: ctx.profileId } })
        const label =
          existing.mode === 'flexible'
            ? `savings pot '${existing.name}'`
            : existing.mode === 'scheduled'
              ? `DPS '${existing.name}'`
              : `investment '${existing.name}'`
        await logActivity(tx, ctx.profileId, {
          action: 'delete',
          entityType: 'investment',
          entityId: null,
          entityLabel: existing.name,
          summary: `Deleted ${label}`,
        })
        return { id: input.id }
      })
    }),

  addDeposit: protectedProcedure
    .input(addDepositSchema)
    .mutation(async ({ ctx, input }) => {
      const depositAmount = Number(input.amount)

      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const investment = await tx.investment.findFirst({
          where: { id: input.investmentId, profileId: ctx.profileId, mode: 'flexible' },
          select: {
            id: true,
            name: true,
            investedAmount: true,
            currentValue: true,
          },
        })
        if (!investment) throw new Error('Savings pot not found')
        const currency = await getProfileCurrency(tx, ctx.profileId)

        const deposit = await tx.investmentDeposit.create({
          data: {
            investmentId: input.investmentId,
            profileId: ctx.profileId,
            amount: input.amount,
            dueDate: new Date(input.depositDate),
            paidAt: new Date(input.depositDate),
            status: 'paid',
            notes: input.notes,
          },
        })
        const newInvested = Number(investment.investedAmount) + depositAmount
        const newCurrentValue = Number(investment.currentValue) + depositAmount
        await tx.investment.updateMany({
          where: { id: input.investmentId, profileId: ctx.profileId },
          data: {
            investedAmount: newInvested.toFixed(2),
            currentValue: newCurrentValue.toFixed(2),
          },
        })

        await logActivity(tx, ctx.profileId, {
          action: 'create',
          entityType: 'investment_deposit',
          entityId: deposit.id,
          entityLabel: investment.name,
          summary: `Added deposit of ${formatCurrency(input.amount, currency)} to '${investment.name}'`,
        })

        return { id: input.investmentId }
      })
    }),

  removeDeposit: protectedProcedure
    .input(removeDepositSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const deposit = await tx.investmentDeposit.findFirst({
          where: { id: input.depositId, profileId: ctx.profileId },
          select: {
            id: true,
            investmentId: true,
            amount: true,
            investment: { select: { name: true } },
          },
        })
        if (!deposit) throw new Error('Deposit not found')
        const currency = await getProfileCurrency(tx, ctx.profileId)

        const removedAmount = Number(deposit.amount)

        await tx.investmentDeposit.deleteMany({
          where: { id: input.depositId, profileId: ctx.profileId },
        })
        // Re-sync investedAmount from remaining deposits
        const remaining = await tx.investmentDeposit.findMany({
          where: { investmentId: deposit.investmentId },
          select: { amount: true },
        })
        const newInvested = remaining.reduce((sum, d) => sum + Number(d.amount), 0)

        const investment = await tx.investment.findUniqueOrThrow({
          where: { id: deposit.investmentId },
          select: { currentValue: true },
        })
        const newCurrentValue = Math.max(
          0,
          Number(investment.currentValue) - removedAmount,
        )

        await tx.investment.updateMany({
          where: { id: deposit.investmentId, profileId: ctx.profileId },
          data: {
            investedAmount: newInvested.toFixed(2),
            currentValue: newCurrentValue.toFixed(2),
          },
        })

        await logActivity(tx, ctx.profileId, {
          action: 'delete',
          entityType: 'investment_deposit',
          entityId: null,
          entityLabel: deposit.investment.name,
          summary: `Removed deposit of ${formatCurrency(deposit.amount, currency)} from '${deposit.investment.name}'`,
        })

        return { id: input.depositId }
      })
    }),

  withdraw: protectedProcedure
    .input(withdrawalSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const investment = await tx.investment.findFirst({
          where: { id: input.investmentId, profileId: ctx.profileId },
          select: {
            id: true,
            name: true,
            mode: true,
            status: true,
            currentValue: true,
          },
        })
        if (!investment) throw new Error('Investment not found')
        if (investment.mode === 'scheduled') {
          throw new Error('Use premature closure for DPS schemes')
        }
        if (investment.status !== 'active') {
          throw new Error('Investment is not active')
        }

        // Keep money math in Decimal space so we don't accumulate the float
        // drift that prompted the legacy `+ 0.001` epsilon. Comparisons and
        // arithmetic happen on `Prisma.Decimal`; we serialize back to a
        // 2dp string only when handing the value to Prisma.
        const amount = new Prisma.Decimal(input.amount)
        const currentValue = new Prisma.Decimal(String(investment.currentValue))
        if (amount.greaterThan(currentValue)) {
          throw new Error('Withdrawal amount exceeds current value')
        }

        const newCurrentValueDec = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          currentValue.minus(amount),
        )
        const shouldClose =
          input.closeInvestment === true || newCurrentValueDec.isZero()

        const currency = await getProfileCurrency(tx, ctx.profileId)

        const withdrawal = await tx.investmentWithdrawal.create({
          data: {
            investmentId: input.investmentId,
            profileId: ctx.profileId,
            amount: input.amount,
            withdrawalDate: new Date(input.withdrawalDate),
            notes: input.notes,
          },
        })

        if (shouldClose) {
          const totals = await tx.investmentWithdrawal.aggregate({
            where: { investmentId: input.investmentId },
            _sum: { amount: true },
          })
          const totalExit = new Prisma.Decimal(String(totals._sum.amount ?? '0'))
          await tx.investment.updateMany({
            where: { id: input.investmentId, profileId: ctx.profileId },
            data: {
              currentValue: newCurrentValueDec.toFixed(2),
              status: 'completed',
              exitValue: totalExit.toFixed(2),
              completedAt: new Date(input.withdrawalDate),
            },
          })
        } else {
          await tx.investment.updateMany({
            where: { id: input.investmentId, profileId: ctx.profileId },
            data: { currentValue: newCurrentValueDec.toFixed(2) },
          })
        }

        const amountFmt = formatCurrency(input.amount, currency)
        const summary = shouldClose
          ? `Closed '${investment.name}' with final withdrawal of ${amountFmt}`
          : `Withdrew ${amountFmt} from '${investment.name}'`
        await logActivity(tx, ctx.profileId, {
          action: 'create',
          entityType: 'investment_withdrawal',
          entityId: withdrawal.id,
          entityLabel: investment.name,
          summary,
        })

        return { id: investment.id, closed: shouldClose }
      })
    }),

  closeDps: protectedProcedure
    .input(dpsCloseSchema)
    .mutation(async ({ ctx, input }) => {
      return withIdempotency(ctx.prisma, ctx.profileId, input.clientMutationId, async (tx) => {
        const investment = await tx.investment.findFirst({
          where: { id: input.investmentId, profileId: ctx.profileId, mode: 'scheduled' },
          select: { id: true, name: true, status: true },
        })
        if (!investment) throw new Error('DPS not found')
        if (investment.status !== 'active') {
          throw new Error('DPS is not active')
        }

        const closureNote = input.notes
          ? `Premature closure. ${input.notes}`
          : 'Premature closure'

        const currency = await getProfileCurrency(tx, ctx.profileId)

        await tx.investmentWithdrawal.create({
          data: {
            investmentId: input.investmentId,
            profileId: ctx.profileId,
            amount: input.receivedAmount,
            withdrawalDate: new Date(input.closureDate),
            notes: closureNote,
          },
        })
        await tx.investmentDeposit.deleteMany({
          where: {
            investmentId: input.investmentId,
            profileId: ctx.profileId,
            status: 'upcoming',
          },
        })
        await tx.investment.updateMany({
          where: { id: input.investmentId, profileId: ctx.profileId },
          data: {
            currentValue: '0.00',
            exitValue: input.receivedAmount,
            status: 'closed',
            completedAt: new Date(input.closureDate),
          },
        })
        await logActivity(tx, ctx.profileId, {
          action: 'update',
          entityType: 'investment',
          entityId: investment.id,
          entityLabel: investment.name,
          summary: `Closed DPS '${investment.name}' — received ${formatCurrency(input.receivedAmount, currency)}`,
        })

        return { id: investment.id }
      })
    }),
})
