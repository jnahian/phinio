import { Link } from '@tanstack/react-router'
import { AlertTriangle, Compass, RefreshCcw } from 'lucide-react'

interface RouteStatusProps {
  icon: 'error' | 'not-found'
  title: string
  description: string
  action?: {
    label: string
    to?: '/' | '/app' | '/login'
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    to: '/' | '/app' | '/login'
  }
}

export function RouteStatus({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: RouteStatusProps) {
  const Icon = icon === 'error' ? AlertTriangle : Compass

  return (
    <main className="noir-bg flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="glass w-full max-w-md rounded-3xl border border-white/5 p-8 text-center shadow-2xl sm:p-10">
        <div
          className={
            'mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ' +
            (icon === 'error'
              ? 'bg-tertiary-container/20 text-tertiary-fixed-dim'
              : 'bg-primary-container/20 text-primary-fixed-dim')
          }
        >
          <Icon className="h-8 w-8" strokeWidth={1.75} />
        </div>
        <h1 className="headline-lg text-on-surface">{title}</h1>
        <p className="body-md mt-3 text-on-surface-variant">{description}</p>

        <div className="mt-8 space-y-3">
          {action &&
            (action.onClick ? (
              <button
                type="button"
                onClick={action.onClick}
                className="btn-primary"
              >
                <RefreshCcw className="h-4 w-4" strokeWidth={2} />
                {action.label}
              </button>
            ) : action.to ? (
              <Link to={action.to} className="btn-primary">
                {action.label}
              </Link>
            ) : null)}
          {secondaryAction && (
            <Link
              to={secondaryAction.to}
              className="block w-full rounded-xl border border-outline-variant/30 py-4 text-center font-display font-semibold text-on-surface transition hover:bg-white/5"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
