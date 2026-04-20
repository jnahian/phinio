import { Link } from '@tanstack/react-router'
import { ArrowRightSvg } from './icons'
import { useInView } from './use-in-view'

export function FinalCta() {
  const { ref, inView } = useInView()

  return (
    <section className="relative py-36 px-6 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        aria-hidden
      >
        <div className="w-[640px] h-[640px] rounded-full bg-primary-container/7 blur-[110px] animate-lp-glow-pulse" />
      </div>

      <div
        ref={ref}
        className="relative z-10 mx-auto max-w-2xl flex flex-col items-center text-center gap-8"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="space-y-3">
          <span
            className="label-sm text-primary"
            style={{ letterSpacing: '0.16em' }}
          >
            GET STARTED TODAY
          </span>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-on-surface tracking-[-0.03em] leading-tight">
            Your vault is waiting.
          </h2>
          <p className="body-md text-on-surface-variant max-w-sm mx-auto">
            Take control of your investments, DPS deposits, savings pots, and
            EMIs — all in one private, encrypted space.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-primary-container text-on-primary-container font-display font-bold text-base shadow-[0_14px_40px_-10px_rgba(37,99,235,0.68)] hover:shadow-[0_20px_50px_-10px_rgba(37,99,235,0.82)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
          >
            Create free account
            <ArrowRightSvg className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-4 rounded-xl font-display font-medium text-base text-on-surface-variant hover:text-on-surface transition-colors duration-200"
          >
            Already have an account?
          </Link>
        </div>
      </div>
    </section>
  )
}
