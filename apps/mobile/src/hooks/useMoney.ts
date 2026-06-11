import { useTranslation } from 'react-i18next'
import { useProfileQuery } from '#/hooks/useProfile'
import { formatCurrency, formatDate } from '#/lib/format'
import type { Currency, Locale } from '#/lib/format'

/**
 * Profile-aware money + date formatters: currency from `profile.get`,
 * numerals from the active i18n language.
 */
export function useMoney() {
  const { i18n } = useTranslation()
  const profile = useProfileQuery()
  const locale: Locale = i18n.language === 'bn' ? 'bn' : 'en'
  const currency: Currency = profile.data?.preferredCurrency ?? 'BDT'
  return {
    currency,
    locale,
    money: (amount: string | null | undefined) =>
      formatCurrency(amount, currency, { locale }),
    date: (value: Date | string | null | undefined) =>
      formatDate(value, locale),
  }
}
