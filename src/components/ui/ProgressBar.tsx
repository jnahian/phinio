import { cn } from '#/lib/cn'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  indicatorClassName?: string
}

export function ProgressBar({
  value,
  max = 100,
  className,
  indicatorClassName,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={cn(
        'h-1 w-full overflow-hidden rounded-full bg-surface-variant/60',
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary-container transition-[width] duration-300',
          indicatorClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
