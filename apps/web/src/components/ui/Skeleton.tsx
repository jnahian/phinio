import type { HTMLAttributes } from 'react'
import { cn } from '#/lib/cn'

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-xl bg-surface-container-high/50',
        className,
      )}
      {...props}
    />
  )
}
