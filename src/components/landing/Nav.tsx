import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo } from '#/components/Logo'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-300 ${
        scrolled ? 'glass' : 'bg-transparent'
      }`}
      style={
        scrolled ? { borderBottom: '1px solid rgba(67,70,85,0.18)' } : undefined
      }
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
        <Logo size="md" />
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="hidden sm:block text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container text-on-primary-container font-display font-semibold text-sm shadow-[0_8px_24px_-6px_rgba(37,99,235,0.45)] hover:shadow-[0_12px_32px_-6px_rgba(37,99,235,0.62)] hover:-translate-y-px transition-all duration-200"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  )
}
