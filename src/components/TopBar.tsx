import { Link } from '@tanstack/react-router'
import { Logo } from './Logo'
import { NotificationBell } from './NotificationBell'

interface TopBarProps {
  userName: string
  avatarUrl: string
}

export function TopBar({ userName, avatarUrl }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-surface/85 px-5 py-3 backdrop-blur-xl">
      <Link to="/app/profile" className="flex items-center gap-3">
        <span className="block h-10 w-10 overflow-hidden rounded-full ring-2 ring-primary-container/40">
          <img
            src={avatarUrl}
            alt={userName}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </span>
        <Logo size="sm" />
      </Link>
      <NotificationBell />
    </header>
  )
}
