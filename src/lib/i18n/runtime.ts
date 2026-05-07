import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from './config'
import type { Locale } from './config'

/**
 * Read the locale from the live document on the client. The server has
 * already set `<html lang>` during SSR, so this is a synchronous, no-RPC
 * lookup. As a defence-in-depth fallback we also probe `document.cookie`
 * in case the lang attribute was stripped by some middleware.
 */
export function detectClientLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE

  // Cookie comes first to match the server-side precedence in
  // detect.server.ts. Otherwise after a language switch the freshly-set
  // cookie is shadowed by the still-stale `<html lang>` from the previous
  // SSR render, and beforeLoad keeps re-resolving the old locale until
  // a full page reload.
  const cookie = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
  if (cookie) {
    try {
      const value = decodeURIComponent(cookie.slice(LOCALE_COOKIE.length + 1))
      if (isLocale(value)) return value
    } catch {
      // Malformed cookie (e.g. lone `%` byte) — ignore and fall through.
    }
  }

  const fromHtml = document.documentElement.lang
  if (isLocale(fromHtml)) return fromHtml

  return DEFAULT_LOCALE
}
