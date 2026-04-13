import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '#/server/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session) {
      throw redirect({ to: '/app' })
    }
  },
  component: SplashScreen,
})

function SplashScreen() {
  return (
    <main className="noir-bg flex min-h-dvh flex-col items-center justify-between px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container shadow-[0_20px_60px_-10px_rgba(37,99,235,0.6)]">
          <AccountBalanceIcon className="h-8 w-8 text-on-primary-container" />
        </div>
        <h1 className="display-lg text-on-surface">Phinio</h1>
        <p className="body-md mt-3 max-w-xs text-on-surface-variant">
          Your finances, simplified.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <Link to="/login" className="btn-primary">
          Login
        </Link>
        <Link
          to="/signup"
          className="block w-full rounded-xl border border-outline-variant/40 py-4 text-center font-display font-semibold text-on-surface transition hover:bg-white/5"
        >
          Create an account
        </Link>
      </div>
    </main>
  )
}

function AccountBalanceIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
      />
    </svg>
  )
}
