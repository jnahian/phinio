import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '#/lib/cn'

export interface ActionMenuItem {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  variant?: 'default' | 'danger' | 'success'
  disabled?: boolean
}

interface ActionMenuProps {
  items: Array<ActionMenuItem>
  ariaLabel: string
  align?: 'left' | 'right'
}

export function ActionMenu({
  items,
  ariaLabel,
  align = 'right',
}: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-white/5"
      >
        <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-30 mt-1 min-w-[12rem] overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-high p-1 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition disabled:opacity-40',
                item.variant === 'danger'
                  ? 'text-tertiary hover:bg-tertiary/10'
                  : item.variant === 'success'
                    ? 'text-secondary hover:bg-secondary/10'
                    : 'text-on-surface hover:bg-white/5',
              )}
            >
              {item.icon && (
                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
