import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
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
  const { email } = Route.useSearch()
  const [isResending, setIsResending] = useState(false)

  async function handleResend() {
    if (!email || isResending) return
    setIsResending(true)
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: '/app',
    })
    setIsResending(false)
    if (error) {
      toast.error(error.message ?? 'Could not resend verification email')
    } else {
      toast.success('Verification email sent again')
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
          Back to login
        </Link>

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container shadow-[0_20px_60px_-10px_rgba(37,99,235,0.5)]">
            <MailCheck
              className="h-8 w-8 text-on-primary-container"
              strokeWidth={1.75}
            />
          </div>
          <h1 className="headline-lg text-on-surface">Check your email</h1>
          <p className="body-md mt-3 max-w-xs text-on-surface-variant">
            We sent a verification link to{' '}
            {email ? (
              <span className="font-semibold text-on-surface">{email}</span>
            ) : (
              'your email address'
            )}
            . Click the link to activate your vault.
          </p>
        </div>

        <div className="rounded-2xl bg-surface-container-lowest p-5">
          <div className="flex items-start gap-3">
            <Mail
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-on-surface-variant"
              strokeWidth={1.75}
            />
            <div className="flex-1 space-y-1">
              <p className="body-sm text-on-surface">Didn't get the email?</p>
              <p className="body-sm text-on-surface-variant/80">
                Check your spam folder or wait a minute before resending. Links
                expire after 1 hour.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResend}
          disabled={!email || isResending}
          className="btn-primary mt-6"
        >
          {isResending ? 'Sending…' : 'Resend verification email'}
        </button>

        <p className="body-sm mt-6 text-center text-on-surface-variant">
          Already verified?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary-fixed-dim hover:underline decoration-primary-container underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
