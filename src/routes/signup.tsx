import { useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { signupSchema } from '#/lib/validators'
import { getSessionFn } from '#/server/auth'

export const Route = createFileRoute('/signup')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session) {
      throw redirect({ to: '/app' })
    }
  },
  component: SignupScreen,
})

function SignupScreen() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [currency, setCurrency] = useState<'BDT' | 'USD'>('BDT')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError(null)

    const parsed = signupSchema.safeParse({
      fullName,
      email,
      password,
      preferredCurrency: currency,
    })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !errs[key]) errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    setIsSubmitting(true)
    const { error } = await authClient.signUp.email({
      name: parsed.data.fullName,
      email: parsed.data.email,
      password: parsed.data.password,
      preferredCurrency: parsed.data.preferredCurrency,
      callbackURL: '/app',
    })
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message ?? 'Unable to create account.')
      return
    }

    navigate({
      to: '/check-email',
      search: { email: parsed.data.email },
    })
  }

  return (
    <main className="noir-bg flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl border border-white/5 p-8 shadow-2xl sm:p-10">
        <header className="mb-8">
          <h1 className="headline-lg text-on-surface">Create your vault</h1>
          <p className="body-md mt-2 text-on-surface-variant">
            A private bank for your finances, in one tap.
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <Field
            id="fullName"
            label="Full name"
            icon={<User className="h-5 w-5" />}
            error={fieldErrors.fullName}
          >
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              className="input-carved"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <Field
            id="email"
            label="Email address"
            icon={<Mail className="h-5 w-5" />}
            error={fieldErrors.email}
          >
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              className="input-carved"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <Field
            id="password"
            label="Password"
            icon={<Lock className="h-5 w-5" />}
            error={fieldErrors.password}
          >
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="input-carved pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </Field>

          <div className="space-y-2">
            <span className="label-sm px-1 text-on-surface-variant">
              Preferred currency
            </span>
            <div className="grid grid-cols-2 gap-3">
              <CurrencyOption
                active={currency === 'BDT'}
                onClick={() => setCurrency('BDT')}
                symbol="৳"
                label="BDT"
                hint="Bangladeshi Taka"
              />
              <CurrencyOption
                active={currency === 'USD'}
                onClick={() => setCurrency('USD')}
                symbol="$"
                label="USD"
                hint="US Dollar"
              />
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-xl bg-error-container/20 px-4 py-3 text-sm text-error"
            >
              {formError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <footer className="mt-8 text-center">
          <p className="body-sm text-on-surface-variant">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-primary-fixed-dim hover:underline decoration-primary-container underline-offset-4"
            >
              Login
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}

function CurrencyOption({
  active,
  onClick,
  symbol,
  label,
  hint,
}: {
  active: boolean
  onClick: () => void
  symbol: string
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-xl bg-primary-container px-4 py-3 text-left text-on-primary-container shadow-[0_10px_30px_-10px_rgba(37,99,235,0.55)]'
          : 'rounded-xl bg-surface-container-lowest px-4 py-3 text-left text-on-surface transition-colors hover:bg-surface-container-low'
      }
      aria-pressed={active}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-bold">{symbol}</span>
        <span className="font-display text-base font-bold">{label}</span>
      </div>
      <span
        className={
          active
            ? 'body-sm text-on-primary-container/80'
            : 'body-sm text-on-surface-variant'
        }
      >
        {hint}
      </span>
    </button>
  )
}

function Field({
  id,
  label,
  icon,
  error,
  children,
}: {
  id: string
  label: string
  icon: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="label-sm px-1 text-on-surface-variant">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline">
          {icon}
        </span>
        {children}
      </div>
      {error && (
        <p className="body-sm px-1 text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
