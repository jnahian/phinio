import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Logo } from '#/components/Logo'
import { useFormatter } from '#/lib/i18n/useFormatter'

export function Footer() {
  const { t } = useTranslation('landing')
  const fmt = useFormatter()
  // Format the year through Intl so Bangla mode renders Bengali numerals
  // (২০২৬) instead of falling back to Latin digits via toString().
  const year = fmt.number(new Date().getFullYear(), { useGrouping: false })
  return (
    <footer
      className="py-10 px-6"
      style={{ borderTop: '1px solid rgba(67,70,85,0.12)' }}
    >
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            aria-label={t('footer.ariaHome')}
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Logo size="xs" />
          </Link>
          <span className="text-on-surface-variant/25 text-xs mx-0.5">—</span>
          <span className="text-xs text-on-surface-variant">
            {t('footer.tagline')}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            to="/changelog"
            className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {t('footer.changelog')}
          </Link>
          <p className="text-xs text-on-surface-variant/45">
            {t('footer.copyright', { year })}
          </p>
        </div>
      </div>
    </footer>
  )
}
