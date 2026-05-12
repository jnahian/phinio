import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  isLocale,
} from './config'
import type { Locale } from './config'

function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

function pickFromAcceptLanguage(header: string | null): Locale | undefined {
  if (!header) return undefined
  const tags = header
    .split(',')
    .map((t) => t.split(';')[0].trim().toLowerCase())
  for (const tag of tags) {
    const primary = tag.split('-')[0]
    if (isLocale(primary)) return primary
  }
  return undefined
}

/**
 * Resolve the request locale. Precedence: cookie > authenticated user
 * preference > Accept-Language > default. Pure function — pass in already-
 * fetched values so it's trivially testable.
 */
export function detectLocale(args: {
  cookieHeader: string | null
  acceptLanguageHeader: string | null
  userPreferredLanguage?: string | null
}): Locale {
  const cookieValue = parseCookie(args.cookieHeader, LOCALE_COOKIE)
  if (isLocale(cookieValue)) return cookieValue

  if (args.userPreferredLanguage && isLocale(args.userPreferredLanguage)) {
    return args.userPreferredLanguage
  }

  const fromHeader = pickFromAcceptLanguage(args.acceptLanguageHeader)
  if (fromHeader) return fromHeader

  return DEFAULT_LOCALE
}

export { SUPPORTED_LOCALES }
