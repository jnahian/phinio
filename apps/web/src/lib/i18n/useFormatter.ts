import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LOCALE, isLocale } from './config'
import type { Locale } from './config'
import { createFormatter } from './format'
import type { Formatter } from './format'

/**
 * Locale-aware formatters for currency, numbers, dates, and relative times.
 * Reads the active locale from the I18nextProvider so output stays in sync
 * with the rest of the UI.
 */
export function useFormatter(): Formatter & {
  locale: Locale
  daysUntilDue: (days: number) => string
  relativeTime: (date: Date | string | number) => string
} {
  const { i18n, t } = useTranslation('common')
  const locale: Locale = isLocale(i18n.language)
    ? i18n.language
    : DEFAULT_LOCALE

  return useMemo(() => {
    const base = createFormatter(locale)
    return {
      ...base,
      locale,
      daysUntilDue: (days: number) => {
        if (days === 0) return t('due.today')
        if (days === 1) return t('due.tomorrow')
        if (days > 0) return t('due.inDays', { count: days })
        return t('due.overdueDays', { count: -days })
      },
      relativeTime: (date) => {
        const d = date instanceof Date ? date : new Date(date)
        const diffMs = d.getTime() - Date.now()
        const diffMin = Math.round(diffMs / 60_000)
        const abs = Math.abs(diffMin)
        if (abs < 1) return t('relativeTime.justNow')
        if (abs < 60) return t('relativeTime.minutesAgo', { count: abs })
        const diffHr = Math.round(abs / 60)
        if (diffHr < 24) return t('relativeTime.hoursAgo', { count: diffHr })
        const diffDay = Math.round(diffHr / 24)
        return t('relativeTime.daysAgo', { count: diffDay })
      },
    }
  }, [locale, t])
}
