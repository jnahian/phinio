import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '#/lib/cn'

type CardVariant = 'default' | 'low' | 'lowest' | 'plain'

const VARIANT_STYLES: Record<CardVariant, string> = {
  default: 'bg-surface-container-high',
  low: 'bg-surface-container-low',
  lowest: 'bg-surface-container-lowest',
  plain: '',
}

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  variant?: CardVariant
}

export function Card({
  variant = 'default',
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn('rounded-2xl p-5', VARIANT_STYLES[variant], className)}
      {...props}
    />
  )
}
