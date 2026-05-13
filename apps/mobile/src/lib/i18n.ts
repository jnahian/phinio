import i18next from 'i18next'
import type { i18n as I18nInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from '@phinio/i18n-resources'

const DEFAULT_LOCALE = 'en'

const I18N_NAMESPACES = [
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

let instance: I18nInstance | null = null

/**
 * Initialise i18next for the mobile app. Resources are pre-loaded from
 * `@phinio/i18n-resources` so `t()` is synchronous from the first
 * render — no Suspense gymnastics needed. The web app has its own
 * SSR-aware init in apps/web/src/lib/i18n/instance.ts; both surfaces
 * read from the same JSON.
 */
export function getI18n(): I18nInstance {
  if (instance) return instance
  const i18n = i18next.createInstance()
  void i18n.use(initReactI18next).init({
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    ns: I18N_NAMESPACES,
    defaultNS: 'common',
    resources,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  })
  instance = i18n
  return i18n
}
