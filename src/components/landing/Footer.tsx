import { Link } from '@tanstack/react-router'
import { Logo } from '#/components/Logo'

export function Footer() {
  return (
    <footer
      className="py-10 px-6"
      style={{ borderTop: '1px solid rgba(67,70,85,0.12)' }}
    >
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Logo size="xs" />
          <span className="text-on-surface-variant/25 text-xs mx-0.5">—</span>
          <span className="text-xs text-on-surface-variant">
            Your private financial vault.
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            to="/changelog"
            className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Changelog
          </Link>
          <p className="text-xs text-on-surface-variant/45">
            © {new Date().getFullYear()} Phinio
          </p>
        </div>
      </div>
    </footer>
  )
}
