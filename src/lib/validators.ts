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
// Investments (PRD §4.1, §9.1)
// ----------------------------------------------------------------------------

export const INVESTMENT_TYPES = [
  'stock',
  'mutual_fund',
  'fd',
  'gold',
  'crypto',
  'other',
] as const
export type InvestmentType = (typeof INVESTMENT_TYPES)[number]

// Positive decimal as string — lets us avoid JS number coercion for money.
const positiveDecimalString = z
  .string()
  .trim()
  .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), {
    message: 'Enter a valid amount (up to 2 decimals)',
  })
  .refine((s) => Number(s) > 0, { message: 'Amount must be greater than 0' })

const isoDateString = z.string().refine(
  (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
  { message: 'Enter a valid date' },
)

export const investmentCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  type: z.enum(INVESTMENT_TYPES),
  investedAmount: positiveDecimalString,
  currentValue: positiveDecimalString,
  dateOfInvestment: isoDateString,
  notes: z.string().trim().max(1000).optional(),
})
export type InvestmentCreateInput = z.infer<typeof investmentCreateSchema>

export const investmentUpdateSchema = investmentCreateSchema
  .extend({
    id: z.string().min(1),
    status: z.enum(['active', 'completed']),
    exitValue: positiveDecimalString.optional(),
    completedAt: isoDateString.optional(),
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
  status: z.enum(['active', 'completed']).default('active'),
  type: z.enum([...INVESTMENT_TYPES, 'all']).default('all'),
})
export type InvestmentListQuery = z.infer<typeof investmentListQuerySchema>

export const investmentIdSchema = z.object({ id: z.string().min(1) })
