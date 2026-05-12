import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '#/lib/cn'

interface BaseFieldProps {
  id: string
  label?: string
  error?: string
  leading?: ReactNode
  trailing?: ReactNode
  prefix?: ReactNode
  description?: string
}

type TextFieldProps = BaseFieldProps &
  Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'prefix'>

export function TextField({
  id,
  label,
  error,
  leading,
  trailing,
  prefix,
  description,
  className,
  ...props
}: TextFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={id}
          className="label-sm block px-1 text-on-surface-variant"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'relative flex items-center gap-3 rounded-2xl bg-surface-container-lowest p-4 focus-within:ring-2 focus-within:ring-primary-container transition',
          error && 'ring-2 ring-error/60',
        )}
      >
        {leading && <span className="text-outline">{leading}</span>}
        {prefix && (
          <span className="font-display text-lg font-bold text-on-surface-variant/70">
            {prefix}
          </span>
        )}
        <input
          id={id}
          className={cn(
            'w-full bg-transparent text-on-surface outline-none placeholder:text-outline/60',
            className,
          )}
          {...props}
        />
        {trailing && (
          <span className="text-outline" aria-hidden>
            {trailing}
          </span>
        )}
      </div>
      {description && !error && (
        <p className="body-sm px-1 text-on-surface-variant/75">{description}</p>
      )}
      {error && (
        <p className="body-sm px-1 text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type TextAreaProps = Omit<BaseFieldProps, 'leading' | 'trailing' | 'prefix'> &
  Omit<ComponentPropsWithoutRef<'textarea'>, 'id'>

export function TextArea({
  id,
  label,
  error,
  description,
  className,
  ...props
}: TextAreaProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={id}
          className="label-sm block px-1 text-on-surface-variant"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'rounded-2xl bg-surface-container-lowest p-4 focus-within:ring-2 focus-within:ring-primary-container transition',
          error && 'ring-2 ring-error/60',
        )}
      >
        <textarea
          id={id}
          rows={3}
          className={cn(
            'w-full resize-none bg-transparent text-on-surface outline-none placeholder:text-outline/60',
            className,
          )}
          {...props}
        />
      </div>
      {description && !error && (
        <p className="body-sm px-1 text-on-surface-variant/75">{description}</p>
      )}
      {error && (
        <p className="body-sm px-1 text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
