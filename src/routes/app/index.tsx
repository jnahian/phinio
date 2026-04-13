import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/app/')({
  component: HomeScreen,
})

function HomeScreen() {
  const { user } = Route.useRouteContext()

  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  const firstName = user.name.split(' ')[0]

  return (
    <main className="noir-bg min-h-dvh px-5 pb-24 pt-12">
      <header className="mb-8">
        <p className="label-md text-on-surface-variant">Welcome</p>
        <h1 className="headline-lg mt-1 text-on-surface">
          Hi, {firstName} <span aria-hidden>👋</span>
        </h1>
      </header>

      <section className="rounded-[1.5rem] bg-gradient-to-br from-primary-container to-[#1e3a8a] p-6 shadow-[0_20px_60px_-20px_rgba(37,99,235,0.5)]">
        <p className="label-sm text-on-primary-container/80">Net worth</p>
        <p className="font-display mt-2 text-4xl font-bold tracking-tight text-on-primary-container">
          —
        </p>
        <p className="body-sm mt-3 text-on-primary-container/70">
          Add investments and EMIs to see your net worth.
        </p>
      </section>

      <div className="mt-10 rounded-2xl bg-surface-container-low p-6">
        <p className="body-md text-on-surface-variant">
          Phase 1 foundation is in place. Navigation, investments, EMIs, and
          dashboard land in phases 2–5.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 rounded-xl border border-outline-variant/40 px-4 py-2 text-sm text-on-surface transition hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </main>
  )
}
