import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { LogOut, Mail } from 'lucide-react'
import { Card } from '#/components/ui/Card'
import { authClient } from '#/lib/auth-client'
import { cn } from '#/lib/cn'
import { updateProfileCurrencyFn } from '#/server/profile'
import type { Currency } from '#/lib/currency'

export const Route = createFileRoute('/app/profile')({
  component: ProfileScreen,
})

function ProfileScreen() {
  const router = useRouter()
  const { user, profile } = Route.useRouteContext()
  const [currency, setCurrency] = useState<Currency>(
    profile.preferredCurrency as Currency,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleCurrencyChange(next: Currency) {
    if (next === currency || isSaving) return
    const previous = currency
    setCurrency(next)
    setIsSaving(true)
    try {
      await updateProfileCurrencyFn({ data: { preferredCurrency: next } })
      await router.invalidate()
    } catch {
      setCurrency(previous)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    await authClient.signOut()
    window.location.href = '/login'
  }

  const initials = getInitials(profile.fullName)

  return (
    <main className="noir-bg min-h-dvh px-5 pb-28 pt-12">
      <header className="mb-8 flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-[#1e3a8a] shadow-[0_20px_60px_-20px_rgba(37,99,235,0.5)]">
          <span className="font-display text-2xl font-bold text-on-primary-container">
            {initials}
          </span>
        </div>
        <h1 className="headline-md mt-4 text-on-surface">{profile.fullName}</h1>
        <p className="body-sm mt-1 flex items-center gap-1.5 text-on-surface-variant">
          <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
          {user.email}
        </p>
      </header>

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
              disabled={isSaving}
            />
            <CurrencyOption
              active={currency === 'USD'}
              onClick={() => handleCurrencyChange('USD')}
              symbol="$"
              label="USD"
              hint="US Dollar"
              disabled={isSaving}
            />
          </div>
        </Card>
      </section>

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
          active
            ? 'text-on-primary-container/80'
            : 'text-on-surface-variant',
        )}
      >
        {hint}
      </span>
    </button>
  )
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
