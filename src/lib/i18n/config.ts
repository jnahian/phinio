export const SUPPORTED_LOCALES = ['en', 'bn'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'phinio.lang'

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  )
}

// BCP-47 tags fed to Intl APIs. Bangla mode uses bn-BD so digits render as
// native Bengali numerals (০-৯) automatically; English mode uses en-BD for
// BDT and en-US for USD (currency-specific tag picked at the formatter level).
export const NUMBER_LOCALE: Record<Locale, string> = {
  en: 'en-BD',
  bn: 'bn-BD',
}

export const DATE_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  bn: 'bn-BD',
}

export const I18N_NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'investments',
  'emis',
  'profile',
  'notifications',
  'validation',
  'activity',
  'withdraw',
  'seedData',
  'landing',
] as const
export type I18nNamespace = (typeof I18N_NAMESPACES)[number]

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  bn: 'বাংলা',
}
