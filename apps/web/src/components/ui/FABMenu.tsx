import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '#/lib/cn'

export interface FABMenuItem {
  to: string
  label: string
  icon?: ReactNode
}

interface FABMenuProps {
  items: FABMenuItem[]
  label: string
  className?: string
}

export function FABMenu({ items, label, className }: FABMenuProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return createPortal(
    <>
      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-30"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div
        className={cn(
          'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-40 flex flex-col items-end gap-3',
          className,
        )}
      >
        {open &&
          [...items].reverse().map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 shadow-lg transition-transform active:scale-95"
            >
              <span className="body-sm font-semibold text-on-surface">
                {item.label}
              </span>
              {item.icon && (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                  {item.icon}
                </span>
              )}
            </Link>
          ))}

        <button
          type="button"
          aria-label={open ? 'Close menu' : label}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container shadow-[0_20px_60px_-10px_rgba(37,99,235,0.6)] transition-all active:scale-95',
            open && 'rotate-45',
          )}
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={2.25} />
          ) : (
            <Plus className="h-6 w-6" strokeWidth={2.25} />
          )}
        </button>
      </div>
    </>,
    document.body,
  )
}
