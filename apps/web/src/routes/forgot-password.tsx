import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Mail } from 'lucide-react'
import { Logo } from '#/components/Logo'
import { authClient } from '#/lib/auth-client'
import { forgotPasswordSchema } from '@phinio/validators'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordScreen,
})

function ForgotPasswordScreen() {
  const { t } = useTranslation('auth')
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
    const { error } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: '/login',
    })
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message ?? t('forgotPassword.genericError'))
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
          {t('forgotPassword.backToLogin')}
        </Link>

        <Logo size="lg" className="justify-center mx-auto mb-6" />

        <header className="mb-8">
          <h1 className="headline-lg text-on-surface">
            {t('forgotPassword.title')}
          </h1>
          <p className="body-md mt-2 text-on-surface-variant">
            {t('forgotPassword.subtitle')}
          </p>
        </header>

        {submitted ? (
          <div
            role="status"
            className="rounded-xl bg-secondary-container/20 px-4 py-5 text-center"
          >
            <p className="body-md text-on-surface">
              {t('forgotPassword.successTitle')}
            </p>
            <p className="body-sm mt-1 text-on-surface-variant">
              {t('forgotPassword.successBody', { email })}
            </p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="label-sm px-1 text-on-surface-variant"
              >
                {t('forgotPassword.emailLabel')}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('forgotPassword.emailPlaceholder')}
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
              {isSubmitting
                ? t('forgotPassword.submitting')
                : t('forgotPassword.submit')}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
