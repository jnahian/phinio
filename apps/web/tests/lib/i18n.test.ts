import { describe, expect, it } from 'vitest'
import { detectLocale } from '#/lib/i18n/detect.server'
import { formatCurrency } from '#/lib/currency'
import { createFormatter } from '#/lib/i18n/format'

describe('detectLocale', () => {
  it('prefers cookie over user preference and Accept-Language', () => {
    const result = detectLocale({
      cookieHeader: 'phinio.lang=bn; other=x',
      acceptLanguageHeader: 'en-US,en;q=0.9',
      userPreferredLanguage: 'en',
    })
    expect(result).toBe('bn')
  })

  it('falls through to user preference when cookie is absent', () => {
    const result = detectLocale({
      cookieHeader: 'theme=dark',
      acceptLanguageHeader: 'en-US,en;q=0.9',
      userPreferredLanguage: 'bn',
    })
    expect(result).toBe('bn')
  })

  it('falls through to Accept-Language when cookie + user preference are absent', () => {
    const result = detectLocale({
      cookieHeader: null,
      acceptLanguageHeader: 'bn-BD,bn;q=0.8,en;q=0.6',
      userPreferredLanguage: null,
    })
    expect(result).toBe('bn')
  })

  it('defaults to en when nothing matches', () => {
    expect(
      detectLocale({
        cookieHeader: null,
        acceptLanguageHeader: null,
      }),
    ).toBe('en')
  })

  it('ignores unsupported cookie values', () => {
    const result = detectLocale({
      cookieHeader: 'phinio.lang=fr',
      acceptLanguageHeader: 'bn',
    })
    expect(result).toBe('bn')
  })
})

describe('formatCurrency — bn locale', () => {
  it('renders BDT amounts with native Bangla digits', () => {
    const formatted = formatCurrency('1234.56', 'BDT', { locale: 'bn' })
    // ৳ + Bangla digits: ১,২৩৪.৫৬
    expect(formatted).toContain('৳')
    expect(formatted).toMatch(/[০-৯]/)
  })

  it('keeps Latin digits in en locale', () => {
    const formatted = formatCurrency('1234.56', 'BDT', { locale: 'en' })
    expect(formatted).toContain('৳')
    expect(formatted).toMatch(/[0-9]/)
  })
})

describe('createFormatter', () => {
  it('formats numbers with Bangla digits in bn mode', () => {
    const fmt = createFormatter('bn')
    expect(fmt.number(42)).toMatch(/[০-৯]/)
  })

  it('formats dates locale-aware', () => {
    const fmt = createFormatter('bn')
    const out = fmt.date(new Date('2026-05-06T00:00:00Z'), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
})
