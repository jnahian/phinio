// Activity-log summary helper: render a monetary amount with a leading currency
// symbol. Mirrors `apps/web/src/lib/currency.ts` for the subset used by server
// code (summary strings). Kept locally so the trpc package doesn't depend on
// the web app.

export type Currency = 'BDT' | 'USD'

type DecimalLike = { toString: () => string } | string | number

const CURRENCY_SYMBOL: Record<Currency, string> = {
  BDT: '৳',
  USD: '$',
}

export function formatCurrency(
  amount: DecimalLike | null | undefined,
  currency: Currency,
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
  const tag = currency === 'USD' ? 'en-US' : 'en-BD'
  const formatter = new Intl.NumberFormat(tag, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const formatted = formatter.format(Math.abs(value))
  const sign = value < 0 ? '-' : ''
  return `${sign}${symbol}${formatted}`
}
