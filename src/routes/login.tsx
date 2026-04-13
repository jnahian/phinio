import { useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { loginSchema } from '#/lib/validators'
import { getSessionFn } from '#/server/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session) {
      throw redirect({ to: '/app' })
    }
  },
  component: LoginScreen,
})

function LoginScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setFormError(null)

    const parsed = loginSchema.safeParse({ email, password })
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
    const { error } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
      callbackURL: '/app',
    })
    setIsSubmitting(false)

    if (error) {
      // Better Auth returns code EMAIL_NOT_VERIFIED when requireEmailVerification
      // is on. sendOnSignIn re-sends the link automatically — we just need to
      // route the user to the check-email screen with a helpful message.
      if (error.code === 'EMAIL_NOT_VERIFIED') {
        navigate({
          to: '/check-email',
          search: { email: parsed.data.email },
        })
        return
      }
      setFormError(error.message ?? 'Login failed. Please try again.')
      return
    }

    navigate({ to: '/app' })
  }

  return (
    <main className="noir-bg flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl border border-white/5 p-8 shadow-2xl sm:p-10">
        <header className="mb-8">
          <h1 className="headline-lg text-on-surface">Welcome back</h1>
          <p className="body-md mt-2 text-on-surface-variant">
            Access your digital vault
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
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
            trailing={
              <Link
                to="/forgot-password"
                className="body-sm font-medium text-primary-fixed-dim hover:text-primary"
              >
                Forgot?
              </Link>
            }
            icon={<Lock className="h-5 w-5" />}
            error={fieldErrors.password}
          >
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
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
            {isSubmitting ? 'Signing in…' : 'Login to Vault'}
          </button>
        </form>

        <footer className="mt-8 text-center">
          <p className="body-sm text-on-surface-variant">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-semibold text-primary-fixed-dim hover:underline decoration-primary-container underline-offset-4"
            >
              Create vault
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}

function Field({
  id,
  label,
  icon,
  trailing,
  error,
  children,
}: {
  id: string
  label: string
  icon: React.ReactNode
  trailing?: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label htmlFor={id} className="label-sm text-on-surface-variant">
          {label}
        </label>
        {trailing}
      </div>
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
