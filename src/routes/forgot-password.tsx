import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Mail } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { forgotPasswordSchema } from '#/lib/validators'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordScreen,
})

function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)
    setFormError(null)

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Invalid email')
      return
    }

    setIsSubmitting(true)
    const { error } = await authClient.forgetPassword({
      email: parsed.data.email,
      redirectTo: '/login',
    })
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message ?? 'Unable to send reset link.')
      return
    }

    setSubmitted(true)
  }

  return (
    <main className="noir-bg flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl border border-white/5 p-8 shadow-2xl sm:p-10">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <header className="mb-8">
          <h1 className="headline-lg text-on-surface">Reset password</h1>
          <p className="body-md mt-2 text-on-surface-variant">
            We'll send a reset link to your inbox.
          </p>
        </header>

        {submitted ? (
          <div
            role="status"
            className="rounded-xl bg-secondary-container/20 px-4 py-5 text-center"
          >
            <p className="body-md text-on-surface">
              Check your email for a reset link.
            </p>
            <p className="body-sm mt-1 text-on-surface-variant">
              If you don't see it, check your spam folder.
            </p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="label-sm px-1 text-on-surface-variant"
              >
                Email address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                  <Mail className="h-5 w-5" />
                </span>
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
              </div>
              {fieldError && (
                <p className="body-sm px-1 text-error" role="alert">
                  {fieldError}
                </p>
              )}
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
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
