/**
 * Decimal-safe financial calculations. Callers should pass strings or Prisma
 * Decimals — the Intl formatting at the UI boundary is the only place JS
 * numbers touch money.
 */

type DecimalLike = { toString: () => string } | string | number

function toString(value: DecimalLike): string {
  return typeof value === 'string' ? value : value.toString()
}

/**
 * Return % = ((current - invested) / invested) × 100.
 * Returned as a plain number rounded to 2 decimals — safe because it's a
 * percentage, not a currency.
 */
export function calculateReturnPercent(
  invested: DecimalLike,
  current: DecimalLike,
): number {
  const i = Number(toString(invested))
  const c = Number(toString(current))
  if (!Number.isFinite(i) || !Number.isFinite(c) || i === 0) return 0
  return Math.round(((c - i) / i) * 10000) / 100
}

/**
 * Profit/loss amount as a string, 2 decimal places.
 */
export function calculateProfitLoss(
  invested: DecimalLike,
  current: DecimalLike,
): string {
  const i = Number(toString(invested))
  const c = Number(toString(current))
  if (!Number.isFinite(i) || !Number.isFinite(c)) return '0.00'
  return (c - i).toFixed(2)
}

export function formatReturnPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
