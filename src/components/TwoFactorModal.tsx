import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import QRCode from 'react-qr-code'
import { Check, Copy, Download, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { OtpInput } from '#/components/ui/OtpInput'
import { TextField } from '#/components/ui/TextField'
import { authClient } from '#/lib/auth-client'

type Step =
  | { name: 'password' }
  | { name: 'verify'; totpURI: string; backupCodes: string[] }
  | { name: 'backup'; backupCodes: string[] }

/**
 * Turns TOTP two-factor on (password → scan/verify → backup codes) or off
 * (password). Mount it only while open so each opening starts fresh.
 * `onChanged` must refresh the cached session: enabling and disabling both
 * rotate the session cookie and flip user.twoFactorEnabled.
 */
export function TwoFactorModal({
  enabled,
  onChanged,
  onClose,
}: {
  enabled: boolean
  onChanged: () => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  // onChanged re-runs the route loader, which flips `enabled` mid-flow.
  const [isDisabling] = useState(enabled)
  const [step, setStep] = useState<Step>({ name: 'password' })
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  // Backup codes are shown once; don't let a stray tap or Esc dismiss them.
  const canDismiss = !isPending && step.name !== 'backup'

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && canDismiss) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canDismiss, onClose])

  function errorMessage(err: {
    status: number
    code?: string
    message?: string
  }) {
    // Better Auth rate-limits /two-factor/* to 3 requests per 10s in prod.
    if (err.status === 429) return t('twoFactor.tooManyAttempts')
    if (err.code === 'INVALID_PASSWORD') return t('twoFactor.wrongPassword')
    if (err.code === 'INVALID_CODE') return t('twoFactor.invalidCode')
    return err.message ?? t('twoFactor.failed')
  }

  async function run(fn: () => Promise<void>) {
    setError('')
    setIsPending(true)
    try {
      await fn()
    } catch {
      setError(t('twoFactor.failed'))
    } finally {
      setIsPending(false)
    }
  }

  function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    void run(async () => {
      if (isDisabling) {
        const { error: err } = await authClient.twoFactor.disable({ password })
        if (err) return setError(errorMessage(err))
        await onChanged()
        toast.success(t('twoFactor.disabled'))
        onClose()
        return
      }

      const { data, error: err } = await authClient.twoFactor.enable({
        password,
      })
      if (err) return setError(errorMessage(err))
      setStep({ name: 'verify', ...data })
    })
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (step.name !== 'verify') return
    void run(async () => {
      const { error: err } = await authClient.twoFactor.verifyTotp({
        code: code.trim(),
      })
      if (err) return setError(errorMessage(err))
      await onChanged()
      setStep({ name: 'backup', backupCodes: step.backupCodes })
    })
  }

  function copy(text: string, message: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(message),
      () => {},
    )
  }

  const errorText = error && (
    <p className="body-sm px-1 text-error" role="alert">
      {error}
    </p>
  )

  const submitButton = (label: string, pendingLabel: string, ok: boolean) => (
    <button
      type="submit"
      disabled={isPending || !ok}
      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3 font-display font-semibold text-on-primary-container transition disabled:opacity-50"
    >
      {isPending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container" />
      ) : (
        <Check className="h-4 w-4" strokeWidth={2.5} />
      )}
      {isPending ? pendingLabel : label}
    </button>
  )

  let body: React.ReactNode
  if (step.name === 'password') {
    body = (
      <form onSubmit={handlePassword} className="space-y-3">
        <p className="body-sm text-on-surface-variant">
          {isDisabling
            ? t('twoFactor.disableIntro')
            : t('twoFactor.enableIntro')}
        </p>
        <TextField
          id="tf-password"
          type="password"
          placeholder={t('twoFactor.passwordLabel')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          autoComplete="current-password"
          autoFocus
        />
        {errorText}
        {isDisabling
          ? submitButton(
              t('twoFactor.disable'),
              t('twoFactor.disabling'),
              !!password,
            )
          : submitButton(
              t('twoFactor.continue'),
              tCommon('actions.loading'),
              !!password,
            )}
      </form>
    )
  } else if (step.name === 'verify') {
    const secret = new URL(step.totpURI).searchParams.get('secret') ?? ''
    body = (
      <form onSubmit={handleVerify} className="space-y-4">
        <p className="body-sm text-on-surface-variant">
          {t('twoFactor.setupIntro')}
        </p>
        {/* On a phone the authenticator lives on the same device, so the
            otpauth:// link is the main path; the QR code is for desktop. */}
        <a
          href={step.totpURI}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/30 py-3 font-display font-semibold text-on-surface transition hover:bg-white/5"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={2} />
          {t('twoFactor.openApp')}
        </a>
        <div className="hidden flex-col items-center gap-2 sm:flex">
          <div className="rounded-xl bg-white p-3">
            <QRCode value={step.totpURI} size={144} />
          </div>
          <p className="text-xs text-on-surface-variant">
            {t('twoFactor.scanQr')}
          </p>
        </div>
        <div className="space-y-1">
          <p className="label-sm px-1 text-on-surface-variant">
            {t('twoFactor.setupKey')}
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2">
            <code className="flex-1 select-all font-mono text-sm text-on-surface">
              {secret.match(/.{1,4}/g)?.join(' ')}
            </code>
            <button
              type="button"
              onClick={() => copy(secret, t('twoFactor.keyCopied'))}
              className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface"
              aria-label={t('twoFactor.copyKey')}
            >
              <Copy className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="tf-code"
            className="label-sm block px-1 text-on-surface-variant"
          >
            {t('twoFactor.codeLabel')}
          </label>
          <OtpInput
            id="tf-code"
            value={code}
            onChange={setCode}
            disabled={isPending}
          />
        </div>
        {errorText}
        {submitButton(
          t('twoFactor.verify'),
          t('twoFactor.verifying'),
          code.length === 6,
        )}
      </form>
    )
  } else {
    body = (
      <div className="space-y-4">
        <p className="body-sm text-on-surface-variant">
          {t('twoFactor.backupIntro')}
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-lowest p-3 font-mono text-sm text-on-surface">
          {step.backupCodes.map((c) => (
            <li key={c} className="text-center">
              {c}
            </li>
          ))}
        </ul>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() =>
              copy(step.backupCodes.join('\n'), t('twoFactor.codesCopied'))
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 py-3 font-display font-semibold text-on-surface transition hover:bg-white/5"
          >
            <Copy className="h-4 w-4" strokeWidth={2} />
            {t('twoFactor.copyCodes')}
          </button>
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(
              `${t('twoFactor.fileHeader')}\n\n${step.backupCodes.join('\n')}\n`,
            )}`}
            download="phinio-backup-codes.txt"
            className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 py-3 font-display font-semibold text-on-surface transition hover:bg-white/5"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            {t('twoFactor.downloadCodes')}
          </a>
        </div>
        <button
          type="button"
          onClick={() => {
            toast.success(t('twoFactor.enabled'))
            onClose()
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3 font-display font-semibold text-on-primary-container transition"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          {t('twoFactor.done')}
        </button>
      </div>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-surface-container-lowest/70 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && canDismiss) onClose()
      }}
    >
      <div className="m-auto w-full max-w-sm rounded-3xl bg-surface-container-high p-6 text-on-surface shadow-[0_20px_60px_-10px_rgba(6,14,32,0.8)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-on-surface">
            {step.name === 'backup'
              ? t('twoFactor.backupTitle')
              : t('twoFactor.title')}
          </h2>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-on-surface-variant/70 transition hover:bg-white/5 hover:text-on-surface"
              aria-label={tCommon('actions.close')}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
        {body}
      </div>
    </div>,
    document.body,
  )
}
