import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Home, TrendingUp, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

type TabPath = '/app' | '/app/investments' | '/app/emis' | '/app/profile'

interface Tab {
  to: TabPath
  labelKey: 'home' | 'investments' | 'emis' | 'profile'
  icon: LucideIcon
  exact?: boolean
}

const TABS: Tab[] = [
  { to: '/app', labelKey: 'home', icon: Home, exact: true },
  { to: '/app/investments', labelKey: 'investments', icon: TrendingUp },
  { to: '/app/emis', labelKey: 'emis', icon: CalendarClock },
  { to: '/app/profile', labelKey: 'profile', icon: User },
]

export function BottomTabBar() {
  const { t } = useTranslation('common')
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/20 bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-2">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <Link to={tab.to} activeOptions={{ exact: tab.exact }}>
              {({ isActive }) => (
                <div
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-[color,transform] duration-150 ease-out active:scale-95',
                    isActive
                      ? 'text-primary-fixed-dim'
                      : 'text-on-surface-variant',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                      isActive && 'bg-primary-container/20',
                    )}
                  >
                    <tab.icon
                      className="h-5 w-5"
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                  </span>
                  <span className="label-sm normal-case tracking-wide">
                    {t(`tabs.${tab.labelKey}`)}
                  </span>
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
