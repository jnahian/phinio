import { useState } from 'react'
import { cn } from '#/lib/cn'

const LENGTH = 6

/**
 * Six-box code input. The boxes are drawn over one transparent <input>, so
 * paste, password-manager / one-time-code autofill and the numeric keypad all
 * behave like a normal field.
 */
export function OtpInput({
  id,
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [isFocused, setIsFocused] = useState(false)
  const activeIndex = Math.min(value.length, LENGTH - 1)

  return (
    <div className={cn('relative', disabled && 'opacity-60')}>
      <div className="grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: LENGTH }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex h-14 items-center justify-center rounded-xl bg-surface-container-lowest font-mono text-xl font-semibold text-on-surface transition',
              isFocused && i === activeIndex && 'ring-2 ring-primary-container',
            )}
          >
            {value[i]}
          </div>
        ))}
      </div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        // No maxLength: it would cut a pasted "123 456" before we strip
        // the space.
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, '').slice(0, LENGTH))
        }
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        autoFocus={autoFocus}
        // text-base keeps iOS Safari from zooming in on focus.
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent"
      />
    </div>
  )
}
