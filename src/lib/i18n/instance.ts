import i18next from 'i18next'
import type { i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE, I18N_NAMESPACES } from './config'
import type { Locale } from './config'
import { resources } from './resources'

/**
 * Create an i18next instance pre-loaded with both English and Bangla
 * resources. On the server, call this per-request so concurrent requests
 * with different locales don't share state. On the client, the singleton
 * exported below is reused for the lifetime of the page.
 */
export function createI18n(locale: Locale = DEFAULT_LOCALE): I18nInstance {
  const i18n = i18next.createInstance()
  // initAsync: false makes init() complete synchronously when resources are
  // already in-memory (which they are — see resources.ts). Without it the
  // first SSR render could hit `t()` before init resolves and emit raw
  // translation keys, breaking hydration. (i18next 26 renamed the older
  // `initImmediate` option to `initAsync`.)
  void i18n.use(initReactI18next).init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    ns: I18N_NAMESPACES as unknown as string[],
    defaultNS: 'common',
    resources,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  })
  return i18n
}

let clientInstance: I18nInstance | null = null

export function getClientI18n(locale: Locale): I18nInstance {
  if (!clientInstance) {
    clientInstance = createI18n(locale)
  } else if (clientInstance.language !== locale) {
    void clientInstance.changeLanguage(locale)
  }
  return clientInstance
}
