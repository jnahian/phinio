import { describe, expect, it } from 'vitest'
import { calculateProfitLoss, calculateReturnPercent } from '@phinio/calc'
import { createFormatter } from '#/lib/i18n/format'

describe('calculateReturnPercent', () => {
  it('returns a positive percent for a gain', () => {
    expect(calculateReturnPercent(100, 120)).toBe(20)
  })

  it('returns a negative percent for a loss', () => {
    expect(calculateReturnPercent(100, 80)).toBe(-20)
  })

  it('returns 0 at break-even', () => {
    expect(calculateReturnPercent(100, 100)).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    // (112.345 - 100) / 100 * 100 = 12.345 → rounds to 12.35
    expect(calculateReturnPercent(100, 112.345)).toBe(12.35)
  })

  it('rounds a losing percent to 2 decimal places', () => {
    // (98.765 - 100) / 100 * 100 = -1.235 → Math.round rounds to -1.23
    // Math.round(-123.5) === -123 in JS, so result is -1.23
    expect(calculateReturnPercent(100, 98.765)).toBe(-1.23)
  })

  it('returns 0 when invested is 0 (divide-by-zero guard)', () => {
    expect(calculateReturnPercent(0, 100)).toBe(0)
  })

  it('returns 0 when invested is NaN', () => {
    expect(calculateReturnPercent(NaN, 100)).toBe(0)
  })

  it('returns 0 when current is NaN', () => {
    expect(calculateReturnPercent(100, NaN)).toBe(0)
  })

  it('returns 0 when either input is Infinity', () => {
    expect(calculateReturnPercent(100, Infinity)).toBe(0)
    expect(calculateReturnPercent(Infinity, 100)).toBe(0)
  })

  it('accepts string, number, and Decimal-like inputs equivalently', () => {
    const fromNumbers = calculateReturnPercent(100, 150)
    const fromStrings = calculateReturnPercent('100', '150')
    const fromDecimalLike = calculateReturnPercent(
      { toString: () => '100' },
      { toString: () => '150' },
    )
    expect(fromNumbers).toBe(50)
    expect(fromStrings).toBe(50)
    expect(fromDecimalLike).toBe(50)
  })
})

describe('calculateProfitLoss', () => {
  it('returns a string', () => {
    expect(typeof calculateProfitLoss('100', '120')).toBe('string')
  })

  it('formats a gain with exactly 2 decimals', () => {
    expect(calculateProfitLoss('100', '120')).toBe('20.00')
  })

  it('formats a loss with a leading minus and 2 decimals', () => {
    expect(calculateProfitLoss('100', '80')).toBe('-20.00')
  })

  it('preserves .50 fractional part', () => {
    expect(calculateProfitLoss('100', '120.5')).toBe('20.50')
  })

  it('returns "0.00" at break-even', () => {
    expect(calculateProfitLoss('100', '100')).toBe('0.00')
  })

  it('returns "0.00" when invested is non-finite', () => {
    expect(calculateProfitLoss(NaN, 100)).toBe('0.00')
  })

  it('returns "0.00" when current is non-finite', () => {
    expect(calculateProfitLoss(100, Infinity)).toBe('0.00')
  })

  it('accepts number inputs', () => {
    expect(calculateProfitLoss(100, 120)).toBe('20.00')
  })

  it('accepts Decimal-like inputs', () => {
    expect(
      calculateProfitLoss({ toString: () => '100' }, { toString: () => '150' }),
    ).toBe('50.00')
  })
})

describe('formatter.percent', () => {
  const enFmt = createFormatter('en')

  it('prefixes positive values with + when showSign is set', () => {
    expect(enFmt.percent(20, { showSign: true })).toBe('+20.00%')
  })

  it('formats zero without a sign prefix', () => {
    expect(enFmt.percent(0, { showSign: true })).toBe('0.00%')
  })

  it('formats negative values with a minus regardless of showSign', () => {
    expect(enFmt.percent(-5.5, { showSign: true })).toBe('-5.50%')
    expect(enFmt.percent(-5.5)).toBe('-5.50%')
  })

  it('always emits exactly 2 decimal places', () => {
    expect(enFmt.percent(12.3, { showSign: true })).toBe('+12.30%')
    expect(enFmt.percent(12.345, { showSign: true })).toBe('+12.35%')
  })

  it('does not prefix + on small negative values', () => {
    expect(enFmt.percent(-0.01, { showSign: true })).toBe('-0.01%')
  })

  it('renders Bangla digits in bn locale', () => {
    const bnFmt = createFormatter('bn')
    expect(bnFmt.percent(12.3, { showSign: true })).toBe('+১২.৩০%')
    expect(bnFmt.percent(-0.01)).toBe('-০.০১%')
  })
})
