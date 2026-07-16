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

// BCP-47 tags fed to Intl APIs. Bangla mode pins the numbering system to
// `beng` via the `-u-nu-beng` Unicode extension because some browser ICU
// builds (notably V8/Chrome) default `bn-BD` to Latin digits — only `bn-IN`
// reliably defaults to native Bengali numerals. The explicit extension keeps
// digit rendering deterministic across Node, Firefox, and Chrome.
export const NUMBER_LOCALE: Record<Locale, string> = {
  en: 'en-BD',
  bn: 'bn-BD-u-nu-beng',
}

export const DATE_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  bn: 'bn-BD-u-nu-beng',
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
