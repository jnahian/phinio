import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Bell, BellOff, BellRing, Check, CheckCheck } from 'lucide-react'
import { cn } from '#/lib/cn'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
} from '#/hooks/useNotifications'
import { usePushSubscription } from '#/hooks/usePushSubscription'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const unreadQuery = useUnreadNotificationCountQuery()
  const listQuery = useNotificationsQuery()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const push = usePushSubscription()

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const unreadCount = unreadQuery.data?.count ?? 0
  const notifications = listQuery.data ?? []

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-error px-1 text-[0.65rem] font-semibold text-on-error">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-surface-container-high shadow-2xl ring-1 ring-outline-variant/20"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="title-sm text-on-surface">Notifications</h2>
            {notifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary-fixed-dim hover:bg-primary-container/20 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {push.isSupported &&
            push.permission === 'default' &&
            !push.isSubscribed && (
              <button
                type="button"
                onClick={() => push.subscribe()}
                disabled={push.isBusy}
                className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl bg-primary-container/40 px-3 py-2 text-left text-xs text-on-primary-container transition hover:bg-primary-container/60 disabled:opacity-60"
              >
                <BellRing
                  className="h-4 w-4 flex-shrink-0"
                  strokeWidth={1.75}
                />
                <span className="flex-1">
                  Enable reminders so you don't miss a payment.
                </span>
              </button>
            )}

          {push.isSupported && push.permission === 'denied' && (
            <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-error-container/30 px-3 py-2 text-xs text-on-error-container">
              <BellOff
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                strokeWidth={1.75}
              />
              <span className="flex-1">
                Reminders are blocked. Re-enable notifications in your browser
                settings to turn them on.
              </span>
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto">
            {listQuery.isLoading ? (
              <div className="px-4 py-10 text-center text-sm text-on-surface-variant">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellOff className="h-8 w-8 text-on-surface-variant/50" />
                <p className="body-sm text-on-surface-variant">
                  You're all caught up.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                {notifications.map((n) => {
                  const inner = (
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                          n.read ? 'bg-transparent' : 'bg-primary-fixed-dim',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p
                            className={cn(
                              'body-sm truncate',
                              n.read
                                ? 'text-on-surface-variant'
                                : 'font-semibold text-on-surface',
                            )}
                          >
                            {n.title}
                          </p>
                          <time className="flex-shrink-0 text-[0.7rem] text-on-surface-variant/70">
                            {formatRelative(n.createdAt)}
                          </time>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">
                          {n.body}
                        </p>
                      </div>
                      {!n.read && (
                        <span
                          className="mt-1 text-on-surface-variant/60"
                          aria-hidden
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  )

                  function handleClick() {
                    if (!n.read) markRead.mutate(n.id)
                    setOpen(false)
                  }

                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          to={n.link}
                          onClick={handleClick}
                          className="block px-4 py-3 transition-colors hover:bg-surface-container-highest"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={handleClick}
                          className="block w-full px-4 py-3 text-left transition-colors hover:bg-surface-container-highest"
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString()
}
