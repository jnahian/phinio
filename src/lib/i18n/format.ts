import { DATE_LOCALE, NUMBER_LOCALE } from './config'
import type { Locale } from './config'
import { formatCurrency } from '#/lib/currency'
import type { Currency } from '#/lib/currency'

export interface Formatter {
  currency: (
    amount: { toString: () => string } | string | number | null | undefined,
    currency: Currency,
    opts?: { compact?: boolean; showSign?: boolean },
  ) => string
  number: (value: number, opts?: Intl.NumberFormatOptions) => string
  date: (
    date: Date | string | number,
    opts?: Intl.DateTimeFormatOptions,
  ) => string
}

/**
 * Build a locale-bound formatter for use outside React (cron, server fns,
 * tests). Inside React components, prefer `useFormatter()` which derives
 * the locale from the i18n provider.
 */
export function createFormatter(locale: Locale): Formatter {
  const numberTag = NUMBER_LOCALE[locale]
  const dateTag = DATE_LOCALE[locale]
  return {
    currency: (amount, currency, opts) =>
      formatCurrency(amount, currency, { ...opts, locale }),
    number: (value, opts) =>
      new Intl.NumberFormat(numberTag, opts).format(value),
    date: (date, opts) => {
      const d = date instanceof Date ? date : new Date(date)
      return new Intl.DateTimeFormat(dateTag, opts).format(d)
    },
  }
}
