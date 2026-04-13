import { cn } from '#/lib/cn'

export interface FilterPill<T extends string> {
  value: T
  label: string
}

interface FilterPillsProps<T extends string> {
  pills: Array<FilterPill<T>>
  active: T
  onChange: (value: T) => void
  className?: string
}

export function FilterPills<T extends string>({
  pills,
  active,
  onChange,
  className,
}: FilterPillsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        '-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {pills.map((pill) => {
        const isActive = pill.value === active
        return (
          <button
            key={pill.value}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(pill.value)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container',
            )}
          >
            {pill.label}
          </button>
        )
      })}
    </div>
  )
}
