import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Globe } from 'lucide-react'
import {
  LOCALE_COOKIE,
  LOCALE_LABEL,
  SUPPORTED_LOCALES,
  isLocale,
} from '#/lib/i18n/config'
import type { Locale } from '#/lib/i18n/config'

/**
 * Anonymous-friendly language switcher used in the landing nav. Writes the
 * locale cookie client-side so the next SSR pass picks it up, then flips the
 * live i18n instance and invalidates the router so `<html lang>` refreshes
 * without a hard reload. Authenticated users get the richer profile-page
 * switcher which also persists their choice on `User`.
 */
export function LangSwitcher() {
  const { i18n } = useTranslation()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const current: Locale = isLocale(i18n.language) ? i18n.language : 'en'

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function selectLocale(next: Locale) {
    setOpen(false)
    if (next === current) return
    // Set the cookie ourselves so the next SSR matches the choice. Mirrors
    // the attributes used by `updateProfileLanguageFn` server-side; `secure`
    // is gated on https so localhost dev still works.
    const secure = window.location.protocol === 'https:' ? '; secure' : ''
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax${secure}`
    void i18n.changeLanguage(next)
    void router.invalidate()
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={LOCALE_LABEL[current]}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <Globe className="h-4 w-4" strokeWidth={1.75} />
        <span>{LOCALE_LABEL[current]}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-40 rounded-xl bg-surface-container-high border border-outline-variant/20 shadow-xl py-1 z-50"
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const active = loc === current
            return (
              <li key={loc} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => selectLocale(loc)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                >
                  <span>{LOCALE_LABEL[loc]}</span>
                  {active && (
                    <Check className="h-4 w-4 text-primary" strokeWidth={2} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
