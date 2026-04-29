import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your full name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  preferredCurrency: z.enum(['BDT', 'USD']),
})
export type SignupInput = z.infer<typeof signupSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// ----------------------------------------------------------------------------
// Shared primitives
// ----------------------------------------------------------------------------

// Optional client-generated UUID that the server uses to dedupe replayed
// mutations. Offline write queues (Phase 3) include this on every mutation;
// online callers can omit it without changing behaviour.
const clientMutationIdField = {
  clientMutationId: z.string().uuid().optional(),
}

// Optional ISO-8601 timestamp the client last saw on the row. The server
// compares against the current `updatedAt` for last-write-wins conflict
// resolution. Only update mutations need this.
const expectedUpdatedAtField = {
  expectedUpdatedAt: z.string().datetime().optional(),
}

const positiveDecimalString = z
  .string()
  .trim()
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
    message: 'Enter a valid amount (up to 2 decimals)',
  })
  .refine((s) => Number(s) > 0, { message: 'Amount must be greater than 0' })

const nonNegativeDecimalString = z
  .string()
  .trim()
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
    message: 'Enter a valid amount (up to 2 decimals)',
  })
  .refine((s) => Number(s) >= 0, { message: 'Amount must be 0 or greater' })

const nonNegativeRateString = z
  .string()
  .trim()
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
    message: 'Enter a valid interest rate (up to 2 decimals)',
  })
  .refine((s) => Number(s) >= 0 && Number(s) < 100, {
    message: 'Rate must be between 0 and 100',
  })

const isoDateString = z
  .string()
  .refine(
    (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
    { message: 'Enter a valid date' },
  )

// ----------------------------------------------------------------------------
// Investments — lump_sum mode (stocks, mutual fund, FD, gold, crypto, other)
// ----------------------------------------------------------------------------

export const INVESTMENT_TYPES = [
  'stock',
  'mutual_fund',
  'fd',
  'gold',
  'crypto',
  'sanchayapatra',
  'real_estate',
  'agro_farm',
  'business',
  'other',
] as const
export type InvestmentType = (typeof INVESTMENT_TYPES)[number]

export const investmentCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  type: z.enum(INVESTMENT_TYPES),
  investedAmount: positiveDecimalString,
  currentValue: positiveDecimalString,
  dateOfInvestment: isoDateString,
  notes: z.string().trim().max(1000).optional(),
  // Client-supplied row id so an offline optimistic create lines up with
  // the server's eventual insert on replay.
  id: z.string().uuid().optional(),
  ...clientMutationIdField,
})
export type InvestmentCreateInput = z.infer<typeof investmentCreateSchema>

export const investmentUpdateSchema = investmentCreateSchema
  .extend({
    id: z.string().min(1),
    status: z.enum(['active', 'completed']),
    exitValue: positiveDecimalString.optional(),
    completedAt: isoDateString.optional(),
    ...expectedUpdatedAtField,
  })
  .refine(
    (data) => {
      if (data.status === 'completed') {
        return Boolean(data.exitValue) && Boolean(data.completedAt)
      }
      return true
    },
    {
      message: 'Completed investments need an exit value and completion date',
      path: ['exitValue'],
    },
  )
export type InvestmentUpdateInput = z.infer<typeof investmentUpdateSchema>

export const investmentListQuerySchema = z.object({
  status: z.enum(['active', 'completed', 'closed']).default('active'),
  type: z.enum([...INVESTMENT_TYPES, 'dps', 'savings', 'all']).default('all'),
})
export type InvestmentListQuery = z.infer<typeof investmentListQuerySchema>

export const investmentIdSchema = z.object({
  id: z.string().min(1),
  ...clientMutationIdField,
})

// ----------------------------------------------------------------------------
// Investments — scheduled mode (DPS: fixed monthly deposit, tenure, interest)
// ----------------------------------------------------------------------------

export const DPS_INTEREST_TYPES = ['simple', 'compound'] as const
export type DpsInterestType = (typeof DPS_INTEREST_TYPES)[number]

export const dpsCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  monthlyDeposit: positiveDecimalString,
  tenureMonths: z
    .number()
    .int('Tenure must be whole months')
    .min(1, 'Tenure must be at least 1 month')
    .max(600, 'Tenure must be 600 months or less'),
  interestRate: nonNegativeRateString,
  interestType: z.enum(DPS_INTEREST_TYPES),
  startDate: isoDateString,
  notes: z.string().trim().max(1000).optional(),
  id: z.string().uuid().optional(),
  ...clientMutationIdField,
})
export type DpsCreateInput = z.infer<typeof dpsCreateSchema>

export const dpsUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(120),
  notes: z.string().trim().max(1000).optional(),
  ...clientMutationIdField,
  ...expectedUpdatedAtField,
})
export type DpsUpdateInput = z.infer<typeof dpsUpdateSchema>

export const markDepositPaidSchema = z.object({
  depositId: z.string().min(1),
  paid: z.boolean(),
  ...clientMutationIdField,
})
export type MarkDepositPaidInput = z.infer<typeof markDepositPaidSchema>

// ----------------------------------------------------------------------------
// Investments — flexible mode (savings: variable deposits, no tenure/interest)
// ----------------------------------------------------------------------------

export const savingsCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  startDate: isoDateString,
  currentValue: nonNegativeDecimalString,
  notes: z.string().trim().max(1000).optional(),
  id: z.string().uuid().optional(),
  ...clientMutationIdField,
})
export type SavingsCreateInput = z.infer<typeof savingsCreateSchema>

export const savingsUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(120),
  currentValue: nonNegativeDecimalString,
  notes: z.string().trim().max(1000).optional(),
  ...clientMutationIdField,
  ...expectedUpdatedAtField,
})
export type SavingsUpdateInput = z.infer<typeof savingsUpdateSchema>

export const addDepositSchema = z.object({
  investmentId: z.string().min(1),
  amount: positiveDecimalString,
  depositDate: isoDateString,
  notes: z.string().trim().max(500).optional(),
  ...clientMutationIdField,
})
export type AddDepositInput = z.infer<typeof addDepositSchema>

export const removeDepositSchema = z.object({
  depositId: z.string().min(1),
  ...clientMutationIdField,
})
export type RemoveDepositInput = z.infer<typeof removeDepositSchema>

// ----------------------------------------------------------------------------
// Investments — withdrawals (lump_sum + flexible) and DPS premature closure
// ----------------------------------------------------------------------------

export const withdrawalSchema = z.object({
  investmentId: z.string().min(1),
  amount: positiveDecimalString,
  withdrawalDate: isoDateString,
  notes: z.string().trim().max(500).optional(),
  closeInvestment: z.boolean().optional(),
  ...clientMutationIdField,
})
export type WithdrawalInput = z.infer<typeof withdrawalSchema>

export const dpsCloseSchema = z.object({
  investmentId: z.string().min(1),
  receivedAmount: positiveDecimalString,
  closureDate: isoDateString,
  notes: z.string().trim().max(500).optional(),
  ...clientMutationIdField,
})
export type DpsCloseInput = z.infer<typeof dpsCloseSchema>

// ----------------------------------------------------------------------------
// EMIs (PRD §4.1, §9.2)
// ----------------------------------------------------------------------------

export const EMI_TYPES = ['bank_loan', 'credit_card'] as const
export type EmiType = (typeof EMI_TYPES)[number]

export const emiCreateSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  type: z.enum(EMI_TYPES),
  principal: positiveDecimalString,
  interestRate: nonNegativeRateString,
  tenureMonths: z
    .number()
    .int('Tenure must be whole months')
    .min(1, 'Tenure must be at least 1 month')
    .max(600, 'Tenure must be 600 months or less'),
  startDate: isoDateString,
  notes: z.string().trim().max(1000).optional(),
  // Optional client-supplied IDs so an offline-created EMI keeps the same
  // identity on both sides of the queue. Without these, the optimistic
  // detail entry in the cache would have UUIDs that the server doesn't
  // know about, and a follow-up "mark paid" tap on a generated payment
  // row would 404 on replay.
  id: z.string().uuid().optional(),
  paymentIds: z.array(z.string().uuid()).optional(),
  ...clientMutationIdField,
})
export type EmiCreateInput = z.infer<typeof emiCreateSchema>

export const emiUpdateSchema = z.object({
  emiId: z.string().min(1),
  label: z.string().trim().min(1, 'Label is required').max(120),
  notes: z.string().trim().max(1000).optional(),
  ...clientMutationIdField,
  ...expectedUpdatedAtField,
})
export type EmiUpdateInput = z.infer<typeof emiUpdateSchema>

export const emiListQuerySchema = z.object({
  type: z.enum([...EMI_TYPES, 'all']).default('all'),
})
export type EmiListQuery = z.infer<typeof emiListQuerySchema>

export const emiIdSchema = z.object({
  emiId: z.string().min(1),
  ...clientMutationIdField,
})

export const markPaymentPaidSchema = z.object({
  paymentId: z.string().min(1),
  paid: z.boolean(),
  ...clientMutationIdField,
})
export type MarkPaymentPaidInput = z.infer<typeof markPaymentPaidSchema>

// ----------------------------------------------------------------------------
// Notifications
// ----------------------------------------------------------------------------

export const markNotificationReadSchema = z.object({
  id: z.string().min(1),
  ...clientMutationIdField,
})
export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadSchema
>

export const markAllNotificationsReadSchema = z.object({
  ...clientMutationIdField,
})
export type MarkAllNotificationsReadInput = z.infer<
  typeof markAllNotificationsReadSchema
>
