import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, getCurrencySymbol } from '../format'

describe('formatCurrency', () => {
  it('formats BDT with the taka symbol, preserving digits across grouping', () => {
    // Grouping style (Indic vs Western) varies by ICU build — assert
    // symbol + digits, not separator placement (mirrors web's tests).
    const out = formatCurrency('1234567.89', 'BDT')
    expect(out.startsWith('৳')).toBe(true)
    expect(out.replace(/[^0-9]/g, '')).toBe('123456789')
  })

  it('formats USD with US grouping', () => {
    expect(formatCurrency('1234567.89', 'USD')).toBe('$1,234,567.89')
  })

  it('keeps two fraction digits for whole amounts', () => {
    expect(formatCurrency('500', 'BDT')).toBe('৳500.00')
  })

  it('renders negative amounts with a leading minus before the symbol', () => {
    expect(formatCurrency('-1200.50', 'USD')).toBe('-$1,200.50')
  })

  it('adds a plus sign for positive amounts when showSign is set', () => {
    expect(formatCurrency('99.95', 'USD', { showSign: true })).toBe('+$99.95')
  })

  it('compact notation drops fraction digits (rounds to whole units)', () => {
    expect(formatCurrency('1500000', 'USD', { compact: true })).toBe('$2M')
    expect(formatCurrency('1200000', 'USD', { compact: true })).toBe('$1M')
  })

  it('renders an em-dash placeholder for null/undefined/garbage', () => {
    expect(formatCurrency(null, 'BDT')).toBe('৳—')
    expect(formatCurrency(undefined, 'USD')).toBe('$—')
    expect(formatCurrency('not-a-number', 'BDT')).toBe('৳—')
  })

  it('renders Bengali numerals in bn locale', () => {
    const formatted = formatCurrency('1234.56', 'BDT', { locale: 'bn' })
    expect(formatted.startsWith('৳')).toBe(true)
    expect(formatted).toMatch(/[০-৯]/)
    expect(formatted).not.toMatch(/[0-9]/)
  })

  it('accepts Decimal-like objects via toString()', () => {
    const decimalLike = { toString: () => '42.10' }
    expect(formatCurrency(decimalLike, 'USD')).toBe('$42.10')
  })
})

describe('getCurrencySymbol', () => {
  it('maps currencies to symbols', () => {
    expect(getCurrencySymbol('BDT')).toBe('৳')
    expect(getCurrencySymbol('USD')).toBe('$')
  })
})

describe('formatDate', () => {
  it('formats a Date day-first with short month', () => {
    expect(formatDate(new Date(Date.UTC(2026, 5, 11)))).toBe('11 Jun 2026')
  })

  it('accepts ISO strings (persister-restored cache entries)', () => {
    expect(formatDate('2026-01-05T00:00:00.000Z')).toBe('5 Jan 2026')
  })

  it('renders an em-dash for null/undefined/invalid input', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('garbage')).toBe('—')
  })

  it('renders Bengali numerals in bn locale', () => {
    const formatted = formatDate(new Date(Date.UTC(2026, 5, 11)), 'bn')
    expect(formatted).toMatch(/[০-৯]/)
  })
})
