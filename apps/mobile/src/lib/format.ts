export type Locale = 'en' | 'bn'

export type Currency = 'BDT' | 'USD'

// Accept anything that has a sensible `.toString()` — Prisma Decimal, string, number.
type DecimalLike = { toString: () => string } | string | number

const CURRENCY_SYMBOL: Record<Currency, string> = {
  BDT: '৳',
  USD: '$',
}

// Pick the BCP-47 tag for Intl.NumberFormat. Bangla mode pins the numbering
// system to `beng` so digits render as native Bengali numerals (০-৯) on every
// ICU build; some default `bn-BD` to Latin digits otherwise. English mode
// keeps the per-currency English locale so USD shows "1,234.56" with US
// grouping and BDT keeps the Indic grouping Bangladeshi users expect.
// Mirrors apps/web/src/lib/currency.ts — extract to a shared package when
// Phase 5 needs input *parsing* on both surfaces too.
function numberLocale(currency: Currency, locale: Locale): string {
  if (locale === 'bn') return 'bn-BD-u-nu-beng'
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

const DATE_LOCALE: Record<Locale, string> = {
  en: 'en-GB', // "11 Jun 2026" — day-first, matching the web app's display
  bn: 'bn-BD-u-nu-beng',
}

/**
 * Format a date for display ("11 Jun 2026"). Accepts Date or ISO string —
 * superjson revives tRPC dates, but persister-restored cache entries can
 * surface strings.
 */
export function formatDate(
  date: Date | string | null | undefined,
  locale: Locale = 'en',
): string {
  if (date === null || date === undefined) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}
