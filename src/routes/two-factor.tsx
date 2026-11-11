import { useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { Logo } from '#/components/Logo'
import { OtpInput } from '#/components/ui/OtpInput'
import { authClient } from '#/lib/auth-client'
import { getSessionFn } from '#/server/auth'

// Second sign-in step for users with 2FA on. /login sends them here after the
// password check; Better Auth holds the pending sign-in in a 10-minute
// httpOnly cookie, so there is nothing to check client-side on entry.
export const Route = createFileRoute('/two-factor')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session) {
      throw redirect({ to: '/app' })
    }
  },
  component: TwoFactorScreen,
})

function TwoFactorScreen() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    const input = { code: code.trim(), trustDevice }
    const { error } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode(input)
      : await authClient.twoFactor.verifyTotp(input)
    setIsSubmitting(false)

    if (error) {
      if (error.status === 429) {
        setFormError(t('twoFactor.tooManyAttempts'))
      } else if (error.code === 'INVALID_TWO_FACTOR_COOKIE') {
        setFormError(t('twoFactor.expired'))
      } else if (
        error.code === 'INVALID_CODE' ||
        error.code === 'INVALID_BACKUP_CODE'
      ) {
        setFormError(t('twoFactor.invalidCode'))
      } else {
        setFormError(error.message ?? t('twoFactor.genericError'))
      }
      return
    }

    navigate({ to: '/app' })
  }

  function toggleMethod() {
    setUseBackupCode((v) => !v)
    setCode('')
    setFormError(null)
  }

  return (
    <main className="noir-bg flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="glass w-full max-w-md rounded-3xl border border-white/5 p-8 shadow-2xl sm:p-10">
        <Logo size="lg" className="justify-center mx-auto mb-8" />
        <header className="mb-8">
          <h1 className="headline-lg text-on-surface">
            {t('twoFactor.title')}
          </h1>
          <p className="body-md mt-2 text-on-surface-variant">
            {useBackupCode
              ? t('twoFactor.backupSubtitle')
              : t('twoFactor.subtitle')}
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <label
              htmlFor="code"
              className="label-sm px-1 text-on-surface-variant"
            >
              {useBackupCode
                ? t('twoFactor.backupLabel')
                : t('twoFactor.codeLabel')}
            </label>
            {useBackupCode ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                  <KeyRound className="h-5 w-5" />
                </span>
                <input
                  id="code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={11}
                  placeholder="xxxxx-xxxxx"
                  className="input-carved font-mono tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
            ) : (
              <OtpInput
                id="code"
                value={code}
                onChange={setCode}
                disabled={isSubmitting}
                autoFocus
              />
            )}
          </div>

          <label className="flex items-center gap-3 px-1 body-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 accent-primary-container"
            />
            {t('twoFactor.trustDevice')}
          </label>

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
            disabled={
              isSubmitting || (useBackupCode ? !code.trim() : code.length !== 6)
            }
          >
            {isSubmitting ? t('twoFactor.submitting') : t('twoFactor.submit')}
          </button>
        </form>

        <footer className="mt-8 space-y-3 text-center">
          <button
            type="button"
            onClick={toggleMethod}
            className="body-sm font-medium text-primary-fixed-dim hover:text-primary"
          >
            {useBackupCode ? t('twoFactor.useApp') : t('twoFactor.useBackup')}
          </button>
          <p>
            <Link
              to="/login"
              className="body-sm text-on-surface-variant hover:text-on-surface"
            >
              {t('twoFactor.backToLogin')}
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}
