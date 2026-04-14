import { useRef, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Camera, Check, ChevronDown, KeyRound, LogOut, Mail, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '#/components/ui/Card'
import { TextField } from '#/components/ui/TextField'
import { authClient } from '#/lib/auth-client'
import { cn } from '#/lib/cn'
import {
  updateProfileCurrencyFn,
  updateProfileNameFn,
} from '#/server/profile'
import type { Currency } from '#/lib/currency'

export const Route = createFileRoute('/app/profile')({
  component: ProfileScreen,
})

function ProfileScreen() {
  const router = useRouter()
  const { user, profile, shellUser } = Route.useRouteContext()

  const [currency, setCurrency] = useState<Currency>(profile.preferredCurrency)
  const [isSavingCurrency, setIsSavingCurrency] = useState(false)

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(profile.fullName)
  const [isSavingName, setIsSavingName] = useState(false)

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>(
    shellUser?.avatarUrl ?? '',
  )

  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [pwForm, setPwForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [pwError, setPwError] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [confirmLogout, setConfirmLogout] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // Currency
  // -------------------------------------------------------------------------

  async function handleCurrencyChange(next: Currency) {
    if (next === currency || isSavingCurrency) return
    const previous = currency
    setCurrency(next)
    setIsSavingCurrency(true)
    try {
      await updateProfileCurrencyFn({ data: { preferredCurrency: next } })
      await router.invalidate()
      toast.success(`Currency set to ${next}`)
    } catch (err) {
      setCurrency(previous)
      toast.error(
        err instanceof Error ? err.message : 'Failed to update currency',
      )
    } finally {
      setIsSavingCurrency(false)
    }
  }

  // -------------------------------------------------------------------------
  // Name
  // -------------------------------------------------------------------------

  function startEditingName() {
    setNameInput(profile.fullName)
    setIsEditingName(true)
  }

  function cancelEditingName() {
    setIsEditingName(false)
    setNameInput(profile.fullName)
  }

  async function saveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed.length < 2 || isSavingName) return
    if (trimmed === profile.fullName) {
      setIsEditingName(false)
      return
    }
    setIsSavingName(true)
    try {
      await updateProfileNameFn({ data: { fullName: trimmed } })
      await router.invalidate()
      setIsEditingName(false)
      toast.success('Name updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name')
    } finally {
      setIsSavingName(false)
    }
  }

  // -------------------------------------------------------------------------
  // Photo
  // -------------------------------------------------------------------------

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ''
    if (!file) return

    setIsUploadingPhoto(true)
    try {
      const dataUrl = await resizeImage(file, 300)
      await authClient.updateUser({ image: dataUrl })
      setAvatarUrl(dataUrl)
      await router.invalidate()
      toast.success('Photo updated')
    } catch {
      toast.error('Failed to update photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // -------------------------------------------------------------------------
  // Change password
  // -------------------------------------------------------------------------

  function openChangePassword() {
    setPwForm({ current: '', next: '', confirm: '' })
    setPwError('')
    setIsChangingPassword(true)
  }

  function closeChangePassword() {
    setIsChangingPassword(false)
    setPwForm({ current: '', next: '', confirm: '' })
    setPwError('')
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwForm.next.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Passwords do not match')
      return
    }
    setIsSavingPassword(true)
    try {
      const result = await authClient.changePassword({
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
        revokeOtherSessions: false,
      })
      if (result.error) {
        setPwError(result.error.message ?? 'Failed to change password')
        return
      }
      closeChangePassword()
      toast.success('Password changed')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setIsSavingPassword(false)
    }
  }

  // -------------------------------------------------------------------------
  // Sign out
  // -------------------------------------------------------------------------

  async function handleSignOut() {
    setIsSigningOut(true)
    await authClient.signOut()
    window.location.href = '/login'
  }

  const initials = getInitials(profile.fullName)

  return (
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-12">
      {/* ------------------------------------------------------------------ */}
      {/* Header — avatar + name                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="mb-8 flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary-container to-[#1e3a8a] shadow-[0_20px_60px_-20px_rgba(37,99,235,0.5)] disabled:opacity-70"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-3xl font-bold text-on-primary-container">
                {initials}
              </span>
            )}
            {/* Hover overlay */}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-disabled:opacity-0">
              {isUploadingPhoto ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" strokeWidth={1.75} />
              )}
            </span>
          </button>

          {/* Camera badge */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant shadow-md transition hover:bg-surface-container disabled:opacity-50"
            aria-label="Change profile photo"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Name — static or inline edit */}
        {isEditingName ? (
          <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
            <TextField
              id="edit-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') cancelEditingName()
              }}
              autoFocus
              disabled={isSavingName}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEditingName}
                disabled={isSavingName}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-outline-variant/30 py-2.5 text-sm text-on-surface-variant transition hover:bg-white/5 disabled:opacity-50"
              >
                <X className="h-4 w-4" strokeWidth={2} />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveName}
                disabled={isSavingName || nameInput.trim().length < 2}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container py-2.5 text-sm font-semibold text-on-primary-container transition disabled:opacity-50"
              >
                {isSavingName ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container" />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                )}
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <h1 className="headline-md text-on-surface">{profile.fullName}</h1>
            <button
              type="button"
              onClick={startEditingName}
              className="rounded-lg p-1 text-on-surface-variant/50 transition hover:bg-white/5 hover:text-on-surface-variant"
              aria-label="Edit name"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        <p className="body-sm mt-1 flex items-center gap-1.5 text-on-surface-variant">
          <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
          {user.email}
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Currency                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-6">
        <h2 className="label-md mb-3 px-1 text-on-surface-variant">
          Preferred currency
        </h2>
        <Card variant="low" className="p-2">
          <div className="grid grid-cols-2 gap-2">
            <CurrencyOption
              active={currency === 'BDT'}
              onClick={() => handleCurrencyChange('BDT')}
              symbol="৳"
              label="BDT"
              hint="Bangladeshi Taka"
              disabled={isSavingCurrency}
            />
            <CurrencyOption
              active={currency === 'USD'}
              onClick={() => handleCurrencyChange('USD')}
              symbol="$"
              label="USD"
              hint="US Dollar"
              disabled={isSavingCurrency}
            />
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Change password                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-6">
        {!isChangingPassword ? (
          <button
            type="button"
            onClick={openChangePassword}
            className="flex w-full items-center justify-between rounded-2xl border border-outline-variant/30 px-5 py-4 text-on-surface transition hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-on-surface-variant" strokeWidth={1.75} />
              <span className="font-display font-semibold">Change password</span>
            </div>
            <ChevronDown className="h-4 w-4 text-on-surface-variant/50" strokeWidth={2} />
          </button>
        ) : (
          <Card variant="low">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="label-md text-on-surface-variant">Change password</h2>
              <button
                type="button"
                onClick={closeChangePassword}
                className="rounded-lg p-1 text-on-surface-variant/50 transition hover:bg-white/5 hover:text-on-surface-variant"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <TextField
                id="pw-current"
                type="password"
                placeholder="Current password"
                value={pwForm.current}
                onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                disabled={isSavingPassword}
                autoComplete="current-password"
              />
              <TextField
                id="pw-new"
                type="password"
                placeholder="New password"
                value={pwForm.next}
                onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                disabled={isSavingPassword}
                autoComplete="new-password"
              />
              <TextField
                id="pw-confirm"
                type="password"
                placeholder="Confirm new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                disabled={isSavingPassword}
                autoComplete="new-password"
              />
              {pwError && (
                <p className="body-sm px-1 text-error" role="alert">{pwError}</p>
              )}
              <button
                type="submit"
                disabled={isSavingPassword || !pwForm.current || !pwForm.next || !pwForm.confirm}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-3 font-display font-semibold text-on-primary-container transition disabled:opacity-50"
              >
                {isSavingPassword ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container" />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                )}
                {isSavingPassword ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </Card>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Sign out                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10">
        {!confirmLogout ? (
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-outline-variant/30 px-4 py-4 text-on-surface transition hover:bg-white/5"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.75} />
            <span className="font-display font-semibold">Sign out</span>
          </button>
        ) : (
          <Card variant="low">
            <p className="body-md mb-4 text-on-surface">
              Sign out of Phinio? You'll need to log in again next time.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-on-surface transition hover:bg-white/5"
                disabled={isSigningOut}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex-1 rounded-xl bg-tertiary-container px-4 py-3 font-display font-semibold text-on-tertiary-container shadow-[0_10px_30px_-10px_rgba(207,44,48,0.5)] transition disabled:opacity-60"
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </Card>
        )}
      </section>

      <p className="body-sm text-center text-on-surface-variant/60">
        Phinio · v0.1.0
      </p>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CurrencyOption({
  active,
  onClick,
  symbol,
  label,
  hint,
  disabled,
}: {
  active: boolean
  onClick: () => void
  symbol: string
  label: string
  hint: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'rounded-xl px-4 py-3 text-left transition disabled:opacity-60',
        active
          ? 'bg-primary-container text-on-primary-container shadow-[0_10px_30px_-10px_rgba(37,99,235,0.55)]'
          : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container',
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-bold">{symbol}</span>
        <span className="font-display text-base font-bold">{label}</span>
      </div>
      <span
        className={cn(
          'body-sm',
          active ? 'text-on-primary-container/80' : 'text-on-surface-variant',
        )}
      >
        {hint}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas not available'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })
}
