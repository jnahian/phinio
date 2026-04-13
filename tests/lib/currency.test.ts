import { describe, expect, it } from 'vitest'
import { formatCurrency, getCurrencySymbol } from '#/lib/currency'

describe('formatCurrency', () => {
  describe('happy paths', () => {
    it('formats a USD number with 2 decimals and $ prefix', () => {
      expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50')
    })

    it('formats a BDT number with 2 decimals and ৳ prefix (below lakh — grouping matches)', () => {
      // 1,234.50 is below one lakh, so en-BD and en-US group identically.
      expect(formatCurrency(1234.5, 'BDT')).toBe('৳1,234.50')
    })

    it('always pads to 2 fraction digits in default mode (whole-number input)', () => {
      expect(formatCurrency(1000, 'USD')).toBe('$1,000.00')
    })

    it('always pads to 2 fraction digits in default mode (BDT whole-number)', () => {
      expect(formatCurrency(1000, 'BDT')).toBe('৳1,000.00')
    })

    it('rounds to 2 fraction digits', () => {
      // 1.235 → 1.24 via Intl half-to-even/up (both locales agree on this case)
      expect(formatCurrency(1.239, 'USD')).toBe('$1.24')
    })

    it('formats zero with two decimals', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0.00')
      expect(formatCurrency(0, 'BDT')).toBe('৳0.00')
    })
  })

  describe('locale grouping', () => {
    it('uses Western grouping for USD (one hundred thousand → 100,000)', () => {
      expect(formatCurrency(100000, 'USD')).toBe('$100,000.00')
    })

    it('formats BDT at one lakh with ৳ prefix and 2 decimals', () => {
      // Grouping follows the runtime's en-BD ICU data. Full ICU → '1,00,000';
      // small-ICU fallback (what Node ships by default) → '100,000'. Assert
      // structurally rather than pinning to one build.
      const out = formatCurrency(100000, 'BDT')
      expect(out.startsWith('৳')).toBe(true)
      expect(out.endsWith('.00')).toBe(true)
      expect(out.replace(/[^0-9]/g, '')).toBe('10000000')
    })

    it('formats BDT at ten lakh with ৳ prefix and 2 decimals', () => {
      const out = formatCurrency(1000000, 'BDT')
      expect(out.startsWith('৳')).toBe(true)
      expect(out.endsWith('.00')).toBe(true)
      expect(out.replace(/[^0-9]/g, '')).toBe('100000000')
    })

    it('uses Western grouping for USD at one million (1,000,000)', () => {
      expect(formatCurrency(1000000, 'USD')).toBe('$1,000,000.00')
    })
  })

  describe('nullish and non-finite inputs', () => {
    it('returns "$—" for null USD', () => {
      expect(formatCurrency(null, 'USD')).toBe('$—')
    })

    it('returns "৳—" for null BDT', () => {
      expect(formatCurrency(null, 'BDT')).toBe('৳—')
    })

    it('returns "$—" for undefined USD', () => {
      expect(formatCurrency(undefined, 'USD')).toBe('$—')
    })

    it('returns "৳—" for undefined BDT', () => {
      expect(formatCurrency(undefined, 'BDT')).toBe('৳—')
    })

    it('returns "$—" when string input is not a finite number', () => {
      expect(formatCurrency('abc', 'USD')).toBe('$—')
    })

    it('returns "৳—" when number input is NaN', () => {
      expect(formatCurrency(NaN, 'BDT')).toBe('৳—')
    })

    it('returns "$—" for Infinity', () => {
      expect(formatCurrency(Infinity, 'USD')).toBe('$—')
    })
  })

  describe('input shapes', () => {
    it('accepts a string input equivalent to its number form', () => {
      expect(formatCurrency('1234.5', 'USD')).toBe(
        formatCurrency(1234.5, 'USD'),
      )
      expect(formatCurrency('1234.5', 'USD')).toBe('$1,234.50')
    })

    it('accepts a Decimal-like object with toString()', () => {
      const decimalLike = { toString: () => '1234.5' }
      expect(formatCurrency(decimalLike, 'USD')).toBe('$1,234.50')
    })
  })

  describe('signs', () => {
    it('renders a negative number with leading "-" before the symbol', () => {
      // Code: `${sign}${meta.symbol}${formatted}` — sign is outside the symbol.
      expect(formatCurrency(-100, 'USD')).toBe('-$100.00')
    })

    it('renders a negative BDT value with leading "-" before the symbol', () => {
      expect(formatCurrency(-100, 'BDT')).toBe('-৳100.00')
    })

    it('showSign: true with a positive value prepends "+"', () => {
      expect(formatCurrency(100, 'USD', { showSign: true })).toBe('+$100.00')
    })

    it('showSign: true with zero does NOT prepend "+" (code checks value > 0)', () => {
      expect(formatCurrency(0, 'USD', { showSign: true })).toBe('$0.00')
    })

    it('showSign: true with a negative value still uses "-", not "+"', () => {
      expect(formatCurrency(-50, 'USD', { showSign: true })).toBe('-$50.00')
    })
  })

  describe('compact mode', () => {
    it('compact mode drops fraction digits and shortens large numbers (USD)', () => {
      // We do not hard-assert the exact compact string across Node/ICU versions;
      // assert the shape: no ".00", no commas (compact notation replaces grouping
      // with a scale marker), and the leading "$".
      const out = formatCurrency(1500000, 'USD', { compact: true })
      expect(out.startsWith('$')).toBe(true)
      expect(out).not.toContain('.00')
      expect(out).not.toContain(',')
      // Compact output should be much shorter than the standard form.
      expect(out.length).toBeLessThan(formatCurrency(1500000, 'USD').length)
    })

    it('compact mode produces a shorter BDT string than standard mode', () => {
      const standard = formatCurrency(1500000, 'BDT')
      const compact = formatCurrency(1500000, 'BDT', { compact: true })
      expect(compact.startsWith('৳')).toBe(true)
      expect(compact).not.toContain('.00')
      expect(compact.length).toBeLessThan(standard.length)
    })

    it('compact mode still renders sign for negatives', () => {
      const out = formatCurrency(-1500000, 'USD', { compact: true })
      expect(out.startsWith('-$')).toBe(true)
    })
  })
})

describe('getCurrencySymbol', () => {
  it('returns "$" for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$')
  })

  it('returns "৳" for BDT', () => {
    expect(getCurrencySymbol('BDT')).toBe('৳')
  })
})
