import { describe, expect, it } from 'vitest'
import { calculateEmi, generateAmortization } from './emi-calculator'

describe('calculateEmi', () => {
  it('matches the standard formula for a typical loan', () => {
    // ৳10,00,000 principal, 12% APR, 120 months
    // EMI = P × r × (1+r)^n / ((1+r)^n - 1)
    // r = 0.01, (1+r)^n ≈ 3.300386..., EMI ≈ 14,347.09
    const result = calculateEmi({
      principal: '1000000',
      annualRate: '12',
      tenureMonths: 120,
    })
    expect(result.emiAmount).toBe('14347.09')
    // Total payment = emi × 120 (rounded emi × n because we round first)
    const total = Number(result.totalPayment)
    expect(total).toBeCloseTo(14347.09 * 120, 2)
    expect(Number(result.totalInterest)).toBeCloseTo(total - 1000000, 2)
  })

  it('handles 0% interest as P / n', () => {
    const result = calculateEmi({
      principal: '12000',
      annualRate: '0',
      tenureMonths: 12,
    })
    expect(result.emiAmount).toBe('1000.00')
    expect(result.totalPayment).toBe('12000.00')
    expect(result.totalInterest).toBe('0.00')
  })

  it('handles a single-month tenure (balance = principal + one month interest)', () => {
    // 10000 principal, 12% APR, 1 month. r = 0.01.
    // EMI = 10000 × 0.01 × 1.01 / 0.01 = 10100
    const result = calculateEmi({
      principal: '10000',
      annualRate: '12',
      tenureMonths: 1,
    })
    expect(result.emiAmount).toBe('10100.00')
    expect(result.totalInterest).toBe('100.00')
  })

  it('accepts number inputs as well as strings', () => {
    const fromString = calculateEmi({
      principal: '500000',
      annualRate: '10',
      tenureMonths: 60,
    })
    const fromNumber = calculateEmi({
      principal: 500000,
      annualRate: 10,
      tenureMonths: 60,
    })
    expect(fromString).toEqual(fromNumber)
  })

  it('throws on invalid principal', () => {
    expect(() =>
      calculateEmi({ principal: '0', annualRate: '10', tenureMonths: 12 }),
    ).toThrow(/Principal/)
  })

  it('throws on negative rate', () => {
    expect(() =>
      calculateEmi({ principal: '1000', annualRate: '-1', tenureMonths: 12 }),
    ).toThrow(/rate/)
  })

  it('throws on non-integer tenure', () => {
    expect(() =>
      calculateEmi({ principal: '1000', annualRate: '10', tenureMonths: 12.5 }),
    ).toThrow(/Tenure/)
  })
})

describe('generateAmortization', () => {
  it('produces exactly tenure rows', () => {
    const rows = generateAmortization({
      principal: '1000000',
      annualRate: '12',
      tenureMonths: 120,
      startDate: new Date('2026-01-15'),
    })
    expect(rows).toHaveLength(120)
  })

  it('the final row clears the remaining balance to exactly 0.00', () => {
    const rows = generateAmortization({
      principal: '1000000',
      annualRate: '12',
      tenureMonths: 120,
      startDate: new Date('2026-01-15'),
    })
    const last = rows[rows.length - 1]
    expect(last.remainingBalance).toBe('0.00')
  })

  it('principal components sum to exactly the principal', () => {
    const rows = generateAmortization({
      principal: '500000',
      annualRate: '9.5',
      tenureMonths: 60,
      startDate: new Date('2026-03-10'),
    })
    const sum = rows.reduce(
      (acc, row) => acc + Number(row.principalComponent),
      0,
    )
    expect(Math.round(sum * 100) / 100).toBe(500000)
  })

  it('handles 0% interest — principal component equals EMI each month', () => {
    const rows = generateAmortization({
      principal: '12000',
      annualRate: '0',
      tenureMonths: 12,
      startDate: new Date('2026-01-01'),
    })
    for (const row of rows) {
      expect(row.interestComponent).toBe('0.00')
      expect(row.principalComponent).toBe('1000.00')
    }
    expect(rows[rows.length - 1].remainingBalance).toBe('0.00')
  })

  it('due dates step one calendar month at a time starting at startDate', () => {
    const rows = generateAmortization({
      principal: '1200',
      annualRate: '0',
      tenureMonths: 3,
      startDate: new Date('2026-01-15'),
    })
    expect(rows[0].dueDate.toISOString().slice(0, 10)).toBe('2026-01-15')
    expect(rows[1].dueDate.toISOString().slice(0, 10)).toBe('2026-02-15')
    expect(rows[2].dueDate.toISOString().slice(0, 10)).toBe('2026-03-15')
  })

  it('clamps end-of-month due dates when the target month is shorter', () => {
    const rows = generateAmortization({
      principal: '900',
      annualRate: '0',
      tenureMonths: 3,
      startDate: new Date('2026-01-31'),
    })
    expect(rows[0].dueDate.toISOString().slice(0, 10)).toBe('2026-01-31')
    // Feb 2026 has 28 days
    expect(rows[1].dueDate.toISOString().slice(0, 10)).toBe('2026-02-28')
    expect(rows[2].dueDate.toISOString().slice(0, 10)).toBe('2026-03-31')
  })

  it('single-month tenure collapses principal and interest into one row', () => {
    const rows = generateAmortization({
      principal: '10000',
      annualRate: '12',
      tenureMonths: 1,
      startDate: new Date('2026-05-01'),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].principalComponent).toBe('10000.00')
    expect(rows[0].interestComponent).toBe('100.00')
    expect(rows[0].emiAmount).toBe('10100.00')
    expect(rows[0].remainingBalance).toBe('0.00')
  })
})
