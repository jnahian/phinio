import type { Locale } from './i18n/config'

export type Currency = 'BDT' | 'USD'

// Accept anything that has a sensible `.toString()` — Prisma Decimal, string, number.
type DecimalLike = { toString: () => string } | string | number

const CURRENCY_SYMBOL: Record<Currency, string> = {
  BDT: '৳',
  USD: '$',
}

// Pick the BCP-47 tag for Intl.NumberFormat. Bangla mode renders native
// Bengali digits (০-৯) automatically. English mode keeps the per-currency
// English locale so USD shows "1,234.56" with US grouping and BDT keeps
// the Indic grouping that Bangladeshi users expect.
function numberLocale(currency: Currency, locale: Locale): string {
  if (locale === 'bn') return 'bn-BD'
  return currency === 'USD' ? 'en-US' : 'en-BD'
}

/**
 * Format a monetary amount in the user's preferred currency.
 * Decimal-safe: pass Prisma Decimal, string, or number directly. Never perform
 * arithmetic on the returned string. Pass `locale` to switch numeral systems
 * (defaults to English digits).
 */
export function formatCurrency(
  amount: DecimalLike | null | undefined,
  currency: Currency,
  options: { compact?: boolean; showSign?: boolean; locale?: Locale } = {},
): string {
  const symbol = CURRENCY_SYMBOL[currency]
  if (amount === null || amount === undefined) {
    return `${symbol}—`
  }

  const raw = typeof amount === 'string' ? amount : amount.toString()
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    return `${symbol}—`
  }

  const tag = numberLocale(currency, options.locale ?? 'en')
  const formatter = new Intl.NumberFormat(tag, {
    style: 'decimal',
    minimumFractionDigits: options.compact ? 0 : 2,
    maximumFractionDigits: options.compact ? 0 : 2,
    notation: options.compact ? 'compact' : 'standard',
  })

  const formatted = formatter.format(Math.abs(value))
  const sign = value < 0 ? '-' : options.showSign && value > 0 ? '+' : ''
  return `${sign}${symbol}${formatted}`
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOL[currency]
}
