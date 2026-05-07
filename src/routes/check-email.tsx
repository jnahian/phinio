import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { Logo } from '#/components/Logo'
import { toast } from 'sonner'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'

const searchSchema = z.object({
  email: z.string().email().optional(),
})

export const Route = createFileRoute('/check-email')({
  validateSearch: (input: unknown) => searchSchema.parse(input),
  component: CheckEmailScreen,
})

function CheckEmailScreen() {
  const { t } = useTranslation('auth')
  const { email } = Route.useSearch()
  const [isResending, setIsResending] = useState(false)

  async function handleResend() {
    if (!email || isResending) return
    setIsResending(true)
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: '/app',
      })
      if (error) {
        toast.error(error.message ?? t('checkEmail.resendFailed'))
      } else {
        toast.success(t('checkEmail.resent'))
      }
    } catch {
      toast.error(t('checkEmail.resendFailed'))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <main className="noir-bg flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl border border-white/5 p-8 shadow-2xl sm:p-10">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('checkEmail.backToLogin')}
        </Link>

        <Logo size="lg" className="justify-center mx-auto mb-6" />

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container shadow-[0_20px_60px_-10px_rgba(37,99,235,0.5)]">
            <MailCheck
              className="h-8 w-8 text-on-primary-container"
              strokeWidth={1.75}
            />
          </div>
          <h1 className="headline-lg text-on-surface">
            {t('checkEmail.title')}
          </h1>
          <p className="body-md mt-3 max-w-xs text-on-surface-variant">
            {t('checkEmail.body', { email: email ?? '' })}
          </p>
        </div>

        <button
          type="button"
          onClick={handleResend}
          disabled={!email || isResending}
          className="btn-primary mt-6"
        >
          {isResending ? t('checkEmail.resending') : t('checkEmail.resend')}
        </button>
      </div>
    </main>
  )
}
