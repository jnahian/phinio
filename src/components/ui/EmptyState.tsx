import type { ReactNode } from 'react'
import { cn } from '#/lib/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl bg-surface-container-low px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-high text-primary-fixed-dim">
          {icon}
        </div>
      )}
      <h3 className="headline-sm text-on-surface">{title}</h3>
      {description && (
        <p className="body-md mt-2 max-w-xs text-on-surface-variant">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
