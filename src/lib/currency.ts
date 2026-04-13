export type Currency = 'BDT' | 'USD'

// Accept anything that has a sensible `.toString()` — Prisma Decimal, string, number.
type DecimalLike = { toString: () => string } | string | number

const CURRENCY_META: Record<Currency, { symbol: string; locale: string }> = {
  BDT: { symbol: '৳', locale: 'en-BD' },
  USD: { symbol: '$', locale: 'en-US' },
}

/**
 * Format a monetary amount in the user's preferred currency.
 * Decimal-safe: pass Prisma Decimal, string, or number directly. Never perform
 * arithmetic on the returned string.
 */
export function formatCurrency(
  amount: DecimalLike | null | undefined,
  currency: Currency,
  options: { compact?: boolean; showSign?: boolean } = {},
): string {
  const meta = CURRENCY_META[currency]
  if (amount === null || amount === undefined) {
    return `${meta.symbol}—`
  }

  const raw = typeof amount === 'string' ? amount : amount.toString()
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    return `${meta.symbol}—`
  }

  const formatter = new Intl.NumberFormat(meta.locale, {
    style: 'decimal',
    minimumFractionDigits: options.compact ? 0 : 2,
    maximumFractionDigits: options.compact ? 0 : 2,
    notation: options.compact ? 'compact' : 'standard',
  })

  const formatted = formatter.format(Math.abs(value))
  const sign = value < 0 ? '-' : options.showSign && value > 0 ? '+' : ''
  return `${sign}${meta.symbol}${formatted}`
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_META[currency].symbol
}
