import { resources as sharedResources } from '@phinio/i18n-resources'
import type { Locale } from './config'

/**
 * Single source of truth for translation messages lives in
 * `@phinio/i18n-resources` so both web (this app) and mobile can consume
 * the same JSON. The web app keeps its own i18next init wiring (SSR
 * pre-load, language detection) in instance.ts / runtime.ts.
 */
export const resources: Record<
  Locale,
  Record<string, Record<string, unknown>>
> = sharedResources
