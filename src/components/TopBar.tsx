import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

interface TopBarProps {
  title?: string | null
  backTo?: string | null
  userName: string
  avatarUrl: string
}

export function TopBar({ title, backTo, userName, avatarUrl }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-surface/85 px-5 py-3 backdrop-blur-xl">
      {/* Left side: back arrow + title OR logo icon + title */}
      <div className="flex min-w-0 items-center gap-3">
        {backTo ? (
          <Link
            to={backTo}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/5"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        ) : (
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-xl">
            <img
              src="/phinio-square.png"
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
            />
          </div>
        )}
        {title ? (
          <h1 className="headline-sm truncate text-on-surface">{title}</h1>
        ) : null}
      </div>

      {/* Right side: notification bell + avatar */}
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <Link
          to="/app/profile"
          className="block h-10 w-10 overflow-hidden rounded-full ring-2 ring-primary-container/40"
          aria-label="Profile"
        >
          <img
            src={avatarUrl}
            alt={userName}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </Link>
      </div>
    </header>
  )
}
