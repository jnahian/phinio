import { Plus } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '#/lib/cn'

interface FABProps {
  to: string
  label: string
  icon?: ReactNode
  className?: string
}

export function FAB({ to, label, icon, className }: FABProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={cn(
        'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container shadow-[0_20px_60px_-10px_rgba(37,99,235,0.6)] transition-transform active:scale-95',
        className,
      )}
    >
      {icon ?? <Plus className="h-6 w-6" strokeWidth={2.25} />}
    </Link>
  )
}
