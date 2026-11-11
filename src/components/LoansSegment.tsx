import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '#/lib/cn'

/** Switch between the two lists that live under the Loans tab. */
export function LoansSegment({ active }: { active: 'emis' | 'personal' }) {
  const { t } = useTranslation('emis')
  const tabClass = (isActive: boolean) =>
    cn(
      'rounded-xl py-2 text-center text-sm font-semibold transition-colors',
      isActive
        ? 'bg-surface-container-highest text-on-surface'
        : 'text-on-surface-variant hover:text-on-surface',
    )
  return (
    <nav className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-surface-container-low p-1">
      <Link to="/app/emis" className={tabClass(active === 'emis')}>
        {t('segment.emis')}
      </Link>
      <Link to="/app/emis/personal" className={tabClass(active === 'personal')}>
        {t('segment.personal')}
      </Link>
    </nav>
  )
}
