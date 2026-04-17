import { describe, expect, it } from 'vitest'
import {
  addDepositSchema,
  dpsCloseSchema,
  dpsCreateSchema,
  dpsUpdateSchema,
  emiCreateSchema,
  emiIdSchema,
  emiListQuerySchema,
  forgotPasswordSchema,
  investmentCreateSchema,
  investmentIdSchema,
  investmentListQuerySchema,
  investmentUpdateSchema,
  loginSchema,
  markDepositPaidSchema,
  markPaymentPaidSchema,
  removeDepositSchema,
  savingsCreateSchema,
  savingsUpdateSchema,
  signupSchema,
  withdrawalSchema,
} from '#/lib/validators'

describe('loginSchema', () => {
  it('parses a valid login payload', () => {
    const result = loginSchema.parse({
      email: 'user@example.com',
      password: 'hunter2',
    })
    expect(result).toEqual({ email: 'user@example.com', password: 'hunter2' })
  })

  it('rejects a malformed email', () => {
    expect(
      loginSchema.safeParse({ email: 'not-an-email', password: 'hunter2' })
        .success,
    ).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'user@example.com', password: '' })
        .success,
    ).toBe(false)
  })
})

describe('signupSchema', () => {
  it('parses a valid signup and trims fullName', () => {
    const result = signupSchema.parse({
      fullName: '  Ada Lovelace  ',
      email: 'ada@example.com',
      password: 'hunter2hunter2',
      preferredCurrency: 'BDT',
    })
    expect(result.fullName).toBe('Ada Lovelace')
    expect(result.preferredCurrency).toBe('BDT')
  })

  it('rejects a fullName shorter than 2 characters after trimming', () => {
    expect(
      signupSchema.safeParse({
        fullName: ' A ',
        email: 'a@example.com',
        password: 'hunter2hunter2',
        preferredCurrency: 'USD',
      }).success,
    ).toBe(false)
  })

  it('rejects passwords shorter than 8 characters', () => {
    expect(
      signupSchema.safeParse({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'short',
        preferredCurrency: 'USD',
      }).success,
    ).toBe(false)
  })

  it('rejects an unsupported preferred currency', () => {
    expect(
      signupSchema.safeParse({
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'hunter2hunter2',
        preferredCurrency: 'EUR',
      }).success,
    ).toBe(false)
  })

  it('accepts USD as a preferred currency', () => {
    const result = signupSchema.parse({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'hunter2hunter2',
      preferredCurrency: 'USD',
    })
    expect(result.preferredCurrency).toBe('USD')
  })
})

describe('forgotPasswordSchema', () => {
  it('parses a valid email', () => {
    expect(forgotPasswordSchema.parse({ email: 'u@example.com' })).toEqual({
      email: 'u@example.com',
    })
  })

  it('rejects a malformed email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(
      false,
    )
  })
})

describe('investmentCreateSchema', () => {
  const valid = {
    name: 'ACME stock',
    type: 'stock' as const,
    investedAmount: '100.00',
    currentValue: '0.5',
    dateOfInvestment: '2026-01-15',
    notes: 'long term hold',
  }

  it('parses a valid investment', () => {
    expect(investmentCreateSchema.parse(valid)).toEqual(valid)
  })

  it('notes is optional', () => {
    const { notes: _notes, ...rest } = valid
    const result = investmentCreateSchema.parse(rest)
    expect(result.notes).toBeUndefined()
  })

  it('rejects an empty name', () => {
    expect(
      investmentCreateSchema.safeParse({ ...valid, name: '   ' }).success,
    ).toBe(false)
  })

  it('rejects an unknown type', () => {
    expect(
      investmentCreateSchema.safeParse({ ...valid, type: 'bond' }).success,
    ).toBe(false)
  })

  it('rejects a negative invested amount', () => {
    expect(
      investmentCreateSchema.safeParse({ ...valid, investedAmount: '-10' })
        .success,
    ).toBe(false)
  })

  it('rejects zero for a positive-amount field', () => {
    expect(
      investmentCreateSchema.safeParse({ ...valid, investedAmount: '0' })
        .success,
    ).toBe(false)
  })

  it('rejects an empty amount string', () => {
    expect(
      investmentCreateSchema.safeParse({ ...valid, investedAmount: '' })
        .success,
    ).toBe(false)
  })

  it('rejects 3+ decimal places on money fields', () => {
    expect(
      investmentCreateSchema.safeParse({ ...valid, currentValue: '10.123' })
        .success,
    ).toBe(false)
  })

  it('rejects an invalid calendar date', () => {
    expect(
      investmentCreateSchema.safeParse({
        ...valid,
        dateOfInvestment: '2026-13-01',
      }).success,
    ).toBe(false)
  })

  it('rejects a non-date string', () => {
    expect(
      investmentCreateSchema.safeParse({
        ...valid,
        dateOfInvestment: 'not-a-date',
      }).success,
    ).toBe(false)
  })

  it('rejects an empty date string', () => {
    expect(
      investmentCreateSchema.safeParse({ ...valid, dateOfInvestment: '' })
        .success,
    ).toBe(false)
  })
})

describe('investmentUpdateSchema', () => {
  const base = {
    id: 'inv_1',
    name: 'ACME stock',
    type: 'stock' as const,
    investedAmount: '100.00',
    currentValue: '150.00',
    dateOfInvestment: '2026-01-15',
  }

  it('parses an active investment without exit fields', () => {
    const result = investmentUpdateSchema.parse({
      ...base,
      status: 'active' as const,
    })
    expect(result.status).toBe('active')
    expect(result.exitValue).toBeUndefined()
    expect(result.completedAt).toBeUndefined()
  })

  it('parses a completed investment with exitValue and completedAt', () => {
    const result = investmentUpdateSchema.parse({
      ...base,
      status: 'completed' as const,
      exitValue: '175.00',
      completedAt: '2026-04-01',
    })
    expect(result.status).toBe('completed')
    expect(result.exitValue).toBe('175.00')
    expect(result.completedAt).toBe('2026-04-01')
  })

  it('rejects completed status without exitValue or completedAt', () => {
    expect(
      investmentUpdateSchema.safeParse({
        ...base,
        status: 'completed',
      }).success,
    ).toBe(false)
  })

  it('rejects completed status with exitValue but no completedAt', () => {
    expect(
      investmentUpdateSchema.safeParse({
        ...base,
        status: 'completed',
        exitValue: '175.00',
      }).success,
    ).toBe(false)
  })

  it('rejects completed status with completedAt but no exitValue', () => {
    expect(
      investmentUpdateSchema.safeParse({
        ...base,
        status: 'completed',
        completedAt: '2026-04-01',
      }).success,
    ).toBe(false)
  })

  it('rejects an empty id', () => {
    expect(
      investmentUpdateSchema.safeParse({
        ...base,
        id: '',
        status: 'active',
      }).success,
    ).toBe(false)
  })
})

describe('investmentListQuerySchema', () => {
  it('defaults status to active and type to all', () => {
    const result = investmentListQuerySchema.parse({})
    expect(result.status).toBe('active')
    expect(result.type).toBe('all')
  })

  it('accepts an explicit type from the enum', () => {
    const result = investmentListQuerySchema.parse({ type: 'gold' })
    expect(result.type).toBe('gold')
  })

  it('accepts dps as a type filter', () => {
    expect(investmentListQuerySchema.parse({ type: 'dps' }).type).toBe('dps')
  })

  it('accepts savings as a type filter', () => {
    expect(investmentListQuerySchema.parse({ type: 'savings' }).type).toBe(
      'savings',
    )
  })

  it('rejects a type outside the enum', () => {
    expect(investmentListQuerySchema.safeParse({ type: 'bond' }).success).toBe(
      false,
    )
  })
})

describe('investmentIdSchema', () => {
  it('parses a non-empty id', () => {
    expect(investmentIdSchema.parse({ id: 'inv_1' })).toEqual({ id: 'inv_1' })
  })

  it('rejects an empty id', () => {
    expect(investmentIdSchema.safeParse({ id: '' }).success).toBe(false)
  })
})

describe('emiCreateSchema', () => {
  const valid = {
    label: 'Home loan',
    type: 'bank_loan' as const,
    principal: '1000000',
    interestRate: '9.5',
    tenureMonths: 120,
    startDate: '2026-01-15',
  }

  it('parses a valid EMI', () => {
    expect(emiCreateSchema.parse(valid)).toEqual(valid)
  })

  it('accepts interestRate of "0"', () => {
    expect(
      emiCreateSchema.parse({ ...valid, interestRate: '0' }).interestRate,
    ).toBe('0')
  })

  it('rejects an interestRate of 100', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, interestRate: '100' }).success,
    ).toBe(false)
  })

  it('rejects an interestRate above 100', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, interestRate: '150' }).success,
    ).toBe(false)
  })

  it('rejects a negative interest rate', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, interestRate: '-1' }).success,
    ).toBe(false)
  })

  it('rejects an interestRate with 3+ decimals', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, interestRate: '9.555' }).success,
    ).toBe(false)
  })

  it('rejects a non-integer tenure', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, tenureMonths: 12.5 }).success,
    ).toBe(false)
  })

  it('rejects tenure less than 1', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, tenureMonths: 0 }).success,
    ).toBe(false)
  })

  it('rejects tenure greater than 600', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, tenureMonths: 601 }).success,
    ).toBe(false)
  })

  it('rejects zero principal', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, principal: '0' }).success,
    ).toBe(false)
  })

  it('rejects an unknown EMI type', () => {
    expect(
      emiCreateSchema.safeParse({ ...valid, type: 'personal_loan' }).success,
    ).toBe(false)
  })
})

describe('emiListQuerySchema', () => {
  it('defaults type to all', () => {
    expect(emiListQuerySchema.parse({}).type).toBe('all')
  })

  it('accepts an explicit type', () => {
    expect(emiListQuerySchema.parse({ type: 'credit_card' }).type).toBe(
      'credit_card',
    )
  })

  it('rejects an unknown type', () => {
    expect(emiListQuerySchema.safeParse({ type: 'mortgage' }).success).toBe(
      false,
    )
  })
})

describe('emiIdSchema', () => {
  it('parses a non-empty emiId', () => {
    expect(emiIdSchema.parse({ emiId: 'emi_1' })).toEqual({ emiId: 'emi_1' })
  })

  it('rejects an empty emiId', () => {
    expect(emiIdSchema.safeParse({ emiId: '' }).success).toBe(false)
  })
})

describe('markPaymentPaidSchema', () => {
  it('parses a valid payload', () => {
    expect(
      markPaymentPaidSchema.parse({ paymentId: 'pay_1', paid: true }),
    ).toEqual({ paymentId: 'pay_1', paid: true })
  })

  it('rejects a non-boolean paid value', () => {
    expect(
      markPaymentPaidSchema.safeParse({ paymentId: 'pay_1', paid: 'yes' })
        .success,
    ).toBe(false)
  })

  it('rejects an empty paymentId', () => {
    expect(
      markPaymentPaidSchema.safeParse({ paymentId: '', paid: true }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DPS schemas
// ---------------------------------------------------------------------------

describe('dpsCreateSchema', () => {
  const valid = {
    name: 'DBBL DPS',
    monthlyDeposit: '5000.00',
    tenureMonths: 24,
    interestRate: '8.00',
    interestType: 'simple' as const,
    startDate: '2026-01-01',
  }

  it('parses a valid DPS payload', () => {
    expect(dpsCreateSchema.parse(valid)).toEqual(valid)
  })

  it('notes is optional', () => {
    const result = dpsCreateSchema.parse(valid)
    expect(result.notes).toBeUndefined()
  })

  it('accepts compound interest type', () => {
    expect(
      dpsCreateSchema.parse({ ...valid, interestType: 'compound' })
        .interestType,
    ).toBe('compound')
  })

  it('accepts zero interest rate', () => {
    expect(
      dpsCreateSchema.parse({ ...valid, interestRate: '0' }).interestRate,
    ).toBe('0')
  })

  it('rejects an empty name', () => {
    expect(dpsCreateSchema.safeParse({ ...valid, name: '' }).success).toBe(
      false,
    )
  })

  it('rejects a non-positive monthly deposit', () => {
    expect(
      dpsCreateSchema.safeParse({ ...valid, monthlyDeposit: '0' }).success,
    ).toBe(false)
  })

  it('rejects a negative monthly deposit', () => {
    expect(
      dpsCreateSchema.safeParse({ ...valid, monthlyDeposit: '-100' }).success,
    ).toBe(false)
  })

  it('rejects tenure of 0', () => {
    expect(
      dpsCreateSchema.safeParse({ ...valid, tenureMonths: 0 }).success,
    ).toBe(false)
  })

  it('rejects tenure greater than 600', () => {
    expect(
      dpsCreateSchema.safeParse({ ...valid, tenureMonths: 601 }).success,
    ).toBe(false)
  })

  it('rejects a non-integer tenure', () => {
    expect(
      dpsCreateSchema.safeParse({ ...valid, tenureMonths: 6.5 }).success,
    ).toBe(false)
  })

  it('rejects an unknown interest type', () => {
    expect(
      dpsCreateSchema.safeParse({ ...valid, interestType: 'flat' }).success,
    ).toBe(false)
  })

  it('rejects an invalid start date', () => {
    expect(
      dpsCreateSchema.safeParse({ ...valid, startDate: 'not-a-date' }).success,
    ).toBe(false)
  })
})

describe('dpsUpdateSchema', () => {
  it('parses a valid update payload', () => {
    const result = dpsUpdateSchema.parse({ id: 'dps_1', name: 'New Name' })
    expect(result.id).toBe('dps_1')
    expect(result.name).toBe('New Name')
    expect(result.notes).toBeUndefined()
  })

  it('accepts optional notes', () => {
    const result = dpsUpdateSchema.parse({
      id: 'dps_1',
      name: 'Name',
      notes: 'Some note',
    })
    expect(result.notes).toBe('Some note')
  })

  it('rejects an empty id', () => {
    expect(dpsUpdateSchema.safeParse({ id: '', name: 'Name' }).success).toBe(
      false,
    )
  })

  it('rejects an empty name', () => {
    expect(dpsUpdateSchema.safeParse({ id: 'dps_1', name: '  ' }).success).toBe(
      false,
    )
  })
})

describe('markDepositPaidSchema', () => {
  it('parses a valid mark-paid payload', () => {
    expect(
      markDepositPaidSchema.parse({ depositId: 'dep_1', paid: true }),
    ).toEqual({ depositId: 'dep_1', paid: true })
  })

  it('parses paid: false (toggle back)', () => {
    expect(
      markDepositPaidSchema.parse({ depositId: 'dep_1', paid: false }).paid,
    ).toBe(false)
  })

  it('rejects an empty depositId', () => {
    expect(
      markDepositPaidSchema.safeParse({ depositId: '', paid: true }).success,
    ).toBe(false)
  })

  it('rejects a non-boolean paid', () => {
    expect(
      markDepositPaidSchema.safeParse({ depositId: 'dep_1', paid: 1 }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Savings schemas
// ---------------------------------------------------------------------------

describe('savingsCreateSchema', () => {
  const valid = {
    name: 'Emergency Fund',
    startDate: '2026-01-01',
    currentValue: '50000.00',
  }

  it('parses a valid savings payload', () => {
    expect(savingsCreateSchema.parse(valid)).toEqual(valid)
  })

  it('accepts zero currentValue', () => {
    expect(
      savingsCreateSchema.parse({ ...valid, currentValue: '0' }).currentValue,
    ).toBe('0')
  })

  it('notes is optional', () => {
    const result = savingsCreateSchema.parse(valid)
    expect(result.notes).toBeUndefined()
  })

  it('rejects an empty name', () => {
    expect(savingsCreateSchema.safeParse({ ...valid, name: '' }).success).toBe(
      false,
    )
  })

  it('rejects a negative currentValue', () => {
    expect(
      savingsCreateSchema.safeParse({ ...valid, currentValue: '-1' }).success,
    ).toBe(false)
  })

  it('rejects 3+ decimal places on currentValue', () => {
    expect(
      savingsCreateSchema.safeParse({ ...valid, currentValue: '100.123' })
        .success,
    ).toBe(false)
  })

  it('rejects an invalid start date', () => {
    expect(
      savingsCreateSchema.safeParse({ ...valid, startDate: '2026-13-01' })
        .success,
    ).toBe(false)
  })
})

describe('savingsUpdateSchema', () => {
  const valid = {
    id: 'sav_1',
    name: 'Updated Fund',
    currentValue: '75000.00',
  }

  it('parses a valid update payload', () => {
    expect(savingsUpdateSchema.parse(valid)).toEqual(valid)
  })

  it('accepts zero currentValue', () => {
    expect(
      savingsUpdateSchema.parse({ ...valid, currentValue: '0' }).currentValue,
    ).toBe('0')
  })

  it('rejects an empty id', () => {
    expect(savingsUpdateSchema.safeParse({ ...valid, id: '' }).success).toBe(
      false,
    )
  })

  it('rejects a negative currentValue', () => {
    expect(
      savingsUpdateSchema.safeParse({ ...valid, currentValue: '-500' }).success,
    ).toBe(false)
  })
})

describe('addDepositSchema', () => {
  const valid = {
    investmentId: 'inv_1',
    amount: '10000.00',
    depositDate: '2026-02-15',
  }

  it('parses a valid add-deposit payload', () => {
    expect(addDepositSchema.parse(valid)).toEqual(valid)
  })

  it('notes is optional', () => {
    const result = addDepositSchema.parse(valid)
    expect(result.notes).toBeUndefined()
  })

  it('rejects an empty investmentId', () => {
    expect(
      addDepositSchema.safeParse({ ...valid, investmentId: '' }).success,
    ).toBe(false)
  })

  it('rejects a non-positive amount', () => {
    expect(addDepositSchema.safeParse({ ...valid, amount: '0' }).success).toBe(
      false,
    )
  })

  it('rejects a negative amount', () => {
    expect(
      addDepositSchema.safeParse({ ...valid, amount: '-100' }).success,
    ).toBe(false)
  })

  it('rejects 3+ decimal places on amount', () => {
    expect(
      addDepositSchema.safeParse({ ...valid, amount: '10.123' }).success,
    ).toBe(false)
  })

  it('rejects an invalid deposit date', () => {
    expect(
      addDepositSchema.safeParse({ ...valid, depositDate: 'not-a-date' })
        .success,
    ).toBe(false)
  })
})

describe('removeDepositSchema', () => {
  it('parses a valid remove-deposit payload', () => {
    expect(removeDepositSchema.parse({ depositId: 'dep_1' })).toEqual({
      depositId: 'dep_1',
    })
  })

  it('rejects an empty depositId', () => {
    expect(removeDepositSchema.safeParse({ depositId: '' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Withdrawal schemas
// ---------------------------------------------------------------------------

describe('withdrawalSchema', () => {
  const valid = {
    investmentId: 'inv_1',
    amount: '500.00',
    withdrawalDate: '2026-03-15',
  }

  it('parses a valid withdrawal payload', () => {
    expect(withdrawalSchema.parse(valid)).toEqual(valid)
  })

  it('notes and closeInvestment are optional', () => {
    const result = withdrawalSchema.parse(valid)
    expect(result.notes).toBeUndefined()
    expect(result.closeInvestment).toBeUndefined()
  })

  it('accepts closeInvestment: true', () => {
    expect(
      withdrawalSchema.parse({ ...valid, closeInvestment: true })
        .closeInvestment,
    ).toBe(true)
  })

  it('accepts closeInvestment: false', () => {
    expect(
      withdrawalSchema.parse({ ...valid, closeInvestment: false })
        .closeInvestment,
    ).toBe(false)
  })

  it('trims and accepts notes', () => {
    expect(
      withdrawalSchema.parse({ ...valid, notes: '  partial sale  ' }).notes,
    ).toBe('partial sale')
  })

  it('rejects an empty investmentId', () => {
    expect(
      withdrawalSchema.safeParse({ ...valid, investmentId: '' }).success,
    ).toBe(false)
  })

  it('rejects a non-positive amount', () => {
    expect(withdrawalSchema.safeParse({ ...valid, amount: '0' }).success).toBe(
      false,
    )
  })

  it('rejects a negative amount', () => {
    expect(
      withdrawalSchema.safeParse({ ...valid, amount: '-100' }).success,
    ).toBe(false)
  })

  it('rejects 3+ decimal places on amount', () => {
    expect(
      withdrawalSchema.safeParse({ ...valid, amount: '10.123' }).success,
    ).toBe(false)
  })

  it('rejects an invalid withdrawal date', () => {
    expect(
      withdrawalSchema.safeParse({ ...valid, withdrawalDate: 'not-a-date' })
        .success,
    ).toBe(false)
  })

  it('rejects an out-of-range calendar date', () => {
    expect(
      withdrawalSchema.safeParse({ ...valid, withdrawalDate: '2026-13-01' })
        .success,
    ).toBe(false)
  })

  it('rejects notes longer than 500 characters', () => {
    expect(
      withdrawalSchema.safeParse({ ...valid, notes: 'x'.repeat(501) }).success,
    ).toBe(false)
  })

  it('rejects a non-boolean closeInvestment', () => {
    expect(
      withdrawalSchema.safeParse({ ...valid, closeInvestment: 'yes' }).success,
    ).toBe(false)
  })
})

describe('dpsCloseSchema', () => {
  const valid = {
    investmentId: 'inv_1',
    receivedAmount: '3950.00',
    closureDate: '2026-05-15',
  }

  it('parses a valid DPS-close payload', () => {
    expect(dpsCloseSchema.parse(valid)).toEqual(valid)
  })

  it('notes is optional', () => {
    expect(dpsCloseSchema.parse(valid).notes).toBeUndefined()
  })

  it('trims and accepts notes', () => {
    expect(
      dpsCloseSchema.parse({ ...valid, notes: '  switched bank  ' }).notes,
    ).toBe('switched bank')
  })

  it('rejects an empty investmentId', () => {
    expect(
      dpsCloseSchema.safeParse({ ...valid, investmentId: '' }).success,
    ).toBe(false)
  })

  it('rejects a non-positive receivedAmount', () => {
    expect(
      dpsCloseSchema.safeParse({ ...valid, receivedAmount: '0' }).success,
    ).toBe(false)
  })

  it('rejects a negative receivedAmount', () => {
    expect(
      dpsCloseSchema.safeParse({ ...valid, receivedAmount: '-50' }).success,
    ).toBe(false)
  })

  it('rejects 3+ decimal places on receivedAmount', () => {
    expect(
      dpsCloseSchema.safeParse({ ...valid, receivedAmount: '100.123' }).success,
    ).toBe(false)
  })

  it('rejects an invalid closure date', () => {
    expect(
      dpsCloseSchema.safeParse({ ...valid, closureDate: 'not-a-date' }).success,
    ).toBe(false)
  })

  it('rejects notes longer than 500 characters', () => {
    expect(
      dpsCloseSchema.safeParse({ ...valid, notes: 'x'.repeat(501) }).success,
    ).toBe(false)
  })
})
