import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '#/components/Logo'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

// ── Scroll-reveal hook ────────────────────────────────────────────────────────

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, inView }
}

// ── Page shell ────────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="bg-surface text-on-surface font-sans overflow-x-hidden">
      <Nav />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass' : 'bg-transparent'
      }`}
      style={
        scrolled ? { borderBottom: '1px solid rgba(67,70,85,0.18)' } : undefined
      }
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
        {/* Logo */}
        <Logo size="md" />
        {/* Actions */}
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

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-20 overflow-hidden">
      {/* Drifting ambient orbs */}
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="absolute -top-24 -left-32 w-[560px] h-[560px] rounded-full bg-primary-container/8 blur-[120px] animate-lp-orb-drift" />
        <div className="absolute -bottom-24 -right-32 w-[480px] h-[480px] rounded-full bg-secondary/6 blur-[100px] animate-lp-orb-drift-2" />
        <div
          className="absolute top-2/3 left-1/3 w-[320px] h-[320px] rounded-full blur-[80px] animate-lp-orb-drift"
          style={{
            background:
              'radial-gradient(circle, rgba(37,99,235,0.07), transparent)',
            animationDelay: '-9s',
          }}
        />
      </div>

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(180,197,255,0.055) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto gap-8">
        {/* Floating logo cluster */}
        <div className="relative animate-lp-float">
          {/* Outer diffuse glow */}
          <div className="absolute inset-0 rounded-[2rem] bg-primary-container/20 blur-3xl scale-[1.7] animate-lp-glow-pulse" />
          {/* Rotating ring 1 */}
          <div
            className="absolute inset-[-16px] rounded-[2.8rem] animate-lp-spin-slow"
            style={{ border: '1px solid rgba(180,197,255,0.09)' }}
          />
          {/* Rotating ring 2 (reverse) */}
          <div
            className="absolute inset-[-30px] rounded-[3.4rem] animate-lp-spin-slow"
            style={{
              border: '1px solid rgba(180,197,255,0.05)',
              animationDuration: '28s',
              animationDirection: 'reverse',
            }}
          />
          {/* Main icon box */}
          <div
            className="relative w-28 h-28 rounded-[2rem] overflow-hidden shadow-[0_24px_64px_-12px_rgba(37,99,235,0.6)]"
            style={{ border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <img
              src="/phinio-square.png"
              alt="Phinio"
              className="w-full h-full object-cover"
            />
          </div>
          {/* Security badge */}
          <div className="absolute -top-3 -right-3 w-9 h-9 bg-secondary rounded-full flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(78,222,163,0.7)]">
            <LockSvg className="w-4 h-4 text-on-secondary" />
          </div>
          {/* Status pill */}
          <div
            className="absolute -bottom-4 -left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-highest shadow-lg"
            style={{ border: '1px solid rgba(67,70,85,0.2)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-lp-glow-pulse" />
            <span className="text-[10px] font-semibold text-on-surface-variant tracking-widest">
              ENCRYPTED
            </span>
          </div>
        </div>

        {/* Eyebrow pill */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container"
          style={{ border: '1px solid rgba(67,70,85,0.25)' }}
        >
          <SparkleSvg className="w-3.5 h-3.5 text-primary" />
          <span
            className="label-sm text-primary"
            style={{ letterSpacing: '0.16em' }}
          >
            DIGITAL PRIVATE VAULT
          </span>
        </div>

        {/* Headline */}
        <div className="space-y-1">
          <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-[-0.03em] text-on-surface">
            Command your
          </h1>
          <h1
            className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-[-0.03em]"
            style={{
              background:
                'linear-gradient(130deg, #b4c5ff 10%, #7ab8f7 50%, #4edea3 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            financial future
          </h1>
        </div>

        {/* Subheadline */}
        <p className="body-md text-on-surface-variant max-w-lg leading-relaxed">
          Investment portfolio tracking and EMI amortization management —
          unified in one private, encrypted vault. Precision without compromise.
        </p>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-1">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-primary-container text-on-primary-container font-display font-bold text-base shadow-[0_14px_40px_-10px_rgba(37,99,235,0.68)] hover:shadow-[0_20px_50px_-10px_rgba(37,99,235,0.82)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
          >
            Open your vault
            <ArrowRightSvg className="w-4 h-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-display font-semibold text-base text-on-surface hover:bg-white/5 transition-all duration-200"
            style={{ border: '1px solid rgba(67,70,85,0.28)' }}
          >
            Sign in
          </Link>
        </div>

        {/* Scroll cue */}
        <div className="mt-6 flex flex-col items-center gap-2 text-on-surface-variant/35 animate-lp-bounce-y">
          <span className="text-[10px] tracking-[0.22em] font-semibold uppercase">
            Explore
          </span>
          <ChevronDownSvg className="w-4 h-4" />
        </div>
      </div>
    </section>
  )
}

// ── Trust bar ─────────────────────────────────────────────────────────────────

const trustItems = [
  {
    Icon: EyeSlashSvg,
    value: '100%',
    label: 'Private',
    sub: 'Zero data sharing, ever',
  },
  {
    Icon: LockSvg,
    value: 'E2E',
    label: 'Encrypted',
    sub: 'Bank-grade security',
  },
  {
    Icon: ActivitySvg,
    value: 'Live',
    label: 'Tracking',
    sub: 'Real-time net worth',
  },
]

function TrustBar() {
  const { ref, inView } = useInView()
  return (
    <section className="py-16 px-6 bg-surface-container-low">
      <div
        ref={ref}
        className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-12"
      >
        {trustItems.map(({ Icon, value, label, sub }, i) => (
          <div
            key={label}
            className="flex flex-col items-center text-center gap-2"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(20px)',
              transition: `opacity 0.55s ease ${i * 100}ms, transform 0.55s ease ${i * 100}ms`,
            }}
          >
            <div className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center mb-1">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-extrabold text-4xl text-on-surface tracking-tight">
              {value}
            </span>
            <span className="text-sm font-semibold text-primary">{label}</span>
            <span className="text-xs text-on-surface-variant">{sub}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────

const features = [
  {
    Icon: ChartLineSvg,
    title: 'Portfolio Tracking',
    description:
      'Stocks, mutual funds, and assets — unified. Monitor performance with editorial precision, powered by real data.',
    accent: 'primary' as const,
  },
  {
    Icon: CalendarSvg,
    title: 'EMI Management',
    description:
      'Full amortization schedules generated upfront. Know your exact payment, interest split, and payoff date.',
    accent: 'secondary' as const,
  },
  {
    Icon: ShieldSvg,
    title: 'Bank-Grade Security',
    description:
      'Your financial data stays encrypted and entirely within your control. No third-party integrations. Ever.',
    accent: 'primary' as const,
  },
  {
    Icon: BarChartSvg,
    title: 'Unified Dashboard',
    description:
      'Net worth at a glance. Investments versus liabilities rendered with the clarity of a private bank statement.',
    accent: 'secondary' as const,
  },
]

function Features() {
  const { ref, inView } = useInView()

  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-16">
          <span
            className="label-sm text-primary"
            style={{ letterSpacing: '0.16em' }}
          >
            CAPABILITIES
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-on-surface tracking-tight mt-3 leading-snug">
            Everything to command
            <br />
            your finances
          </h2>
        </div>

        {/* Card grid */}
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map(({ Icon, title, description, accent }, i) => {
            const isPrimary = accent === 'primary'
            return (
              /* Reveal wrapper */
              <div
                key={title}
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(28px)',
                  transition: `opacity 0.55s ease ${i * 110}ms, transform 0.55s ease ${i * 110}ms`,
                }}
              >
                {/* Hover card */}
                <div
                  className="group relative h-full p-7 rounded-2xl bg-surface-container-high cursor-default overflow-hidden hover:-translate-y-1 transition-all duration-300"
                  style={{ border: '1px solid rgba(67,70,85,0.18)' }}
                >
                  {/* Corner glow on hover */}
                  <div
                    className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                      isPrimary ? 'bg-primary-container/12' : 'bg-secondary/10'
                    }`}
                  />

                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 ${
                      isPrimary ? 'bg-primary-container/12' : 'bg-secondary/10'
                    }`}
                  >
                    <Icon
                      className={`w-6 h-6 ${isPrimary ? 'text-primary' : 'text-secondary'}`}
                      animated={inView}
                    />
                  </div>

                  <h3 className="font-display font-bold text-lg text-on-surface tracking-tight mb-2">
                    {title}
                  </h3>
                  <p className="body-sm text-on-surface-variant leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ── How it works ──────────────────────────────────────────────────────────────

const steps = [
  {
    num: '01',
    Icon: VaultSvg,
    title: 'Create your vault',
    description:
      'Sign up in seconds. No credit card, no third-party connections, no data sold to anyone.',
  },
  {
    num: '02',
    Icon: CalendarSvg,
    title: 'Add your assets',
    description:
      'Log investments and EMIs. Full amortization tables generate automatically with zero manual math.',
  },
  {
    num: '03',
    Icon: BarChartSvg,
    title: 'Watch it compound',
    description:
      'Your unified dashboard updates live. Command your financial future with precision and confidence.',
  },
]

function HowItWorks() {
  const { ref, inView } = useInView()

  return (
    <section className="py-24 px-6 bg-surface-container-low">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <span
            className="label-sm text-secondary"
            style={{ letterSpacing: '0.16em' }}
          >
            HOW IT WORKS
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-on-surface tracking-tight mt-3 leading-snug">
            From sign-up to insight
            <br />
            in minutes
          </h2>
        </div>

        {/* Steps */}
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {steps.map(({ num, Icon, title, description }, i) => (
            <div
              key={num}
              className="flex flex-col items-center text-center gap-5"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.55s ease ${i * 140}ms, transform 0.55s ease ${i * 140}ms`,
              }}
            >
              {/* Icon + number badge */}
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl bg-surface-container-high flex items-center justify-center"
                  style={{ border: '1px solid rgba(67,70,85,0.18)' }}
                >
                  <Icon className="w-9 h-9 text-primary" animated={inView} />
                </div>
                <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-primary-container flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.55)]">
                  <span className="font-display font-bold text-[10px] text-on-primary-container">
                    {num}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg text-on-surface tracking-tight mb-2">
                  {title}
                </h3>
                <p className="body-sm text-on-surface-variant leading-relaxed max-w-xs mx-auto">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCta() {
  const { ref, inView } = useInView()

  return (
    <section className="relative py-36 px-6 overflow-hidden">
      {/* Centered glow */}
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
            Take control of your investments and loans — all in one private,
            encrypted space.
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

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
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
        <p className="text-xs text-on-surface-variant/45">
          © {new Date().getFullYear()} Phinio. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

interface SvgProps {
  className?: string
  animated?: boolean
}

function VaultSvg({ className }: SvgProps) {
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
        d="M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
      />
    </svg>
  )
}

function LockSvg({ className }: SvgProps) {
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
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

function ShieldSvg({ className, animated }: SvgProps) {
  // Shield body draws in, then the check mark draws in after
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      {/* Shield outline */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M12 2.25c-5.25 0-9 3.75-9 3.75S3.75 18 12 21.75C20.25 18 20.25 6 20.25 6S16.5 2.25 12 2.25z"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 1s ease 0.1s' : 'none',
        }}
      />
      {/* Checkmark */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M9 12.75L11.25 15 15 9.75"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.6s ease 0.9s' : 'none',
        }}
      />
    </svg>
  )
}

function ChartLineSvg({ className, animated }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      {/* Trend line */}
      <polyline
        points="3,18 8,11.5 13,14.5 21,6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 1.2s ease 0.2s' : 'none',
        }}
      />
      {/* Arrow cap */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M17.5 6H21v3.5"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.5s ease 1.2s' : 'none',
        }}
      />
      {/* Baseline */}
      <line
        x1="3"
        y1="21"
        x2="21"
        y2="21"
        strokeLinecap="round"
        strokeOpacity="0.25"
      />
    </svg>
  )
}

function CalendarSvg({ className, animated }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      {/* Calendar body */}
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2"
        pathLength="1"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.9s ease 0.1s' : 'none',
        }}
      />
      {/* Header divider */}
      <line
        x1="3"
        y1="9"
        x2="21"
        y2="9"
        strokeLinecap="round"
        strokeOpacity={animated ? 1 : 0}
        style={{
          transition: animated ? 'stroke-opacity 0.3s ease 0.8s' : 'none',
        }}
      />
      {/* Date pins */}
      <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
      {/* Dollar symbol in body */}
      <path
        strokeLinecap="round"
        pathLength="1"
        d="M12 12.5v5M10 13.5h3a1.5 1.5 0 010 3h-2a1.5 1.5 0 000 3h3"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.7s ease 0.9s' : 'none',
        }}
      />
    </svg>
  )
}

function BarChartSvg({ className, animated }: SvgProps) {
  const bars = [
    { x: 3, h: 10, y: 11, delay: 0.2 },
    { x: 9, h: 15, y: 6, delay: 0.35 },
    { x: 15, h: 7, y: 14, delay: 0.5 },
  ]
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
    >
      {bars.map(({ x, h, y, delay }) => (
        <rect
          key={x}
          x={x}
          y={y}
          width={5}
          height={h}
          rx={1.5}
          fill="currentColor"
          opacity={0.85}
          style={{
            transformOrigin: `${x + 2.5}px 21px`,
            transform: animated ? 'scaleY(1)' : 'scaleY(0)',
            transition: animated
              ? `transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay}s`
              : 'none',
          }}
        />
      ))}
      {/* Baseline */}
      <line
        x1="2"
        y1="21"
        x2="22"
        y2="21"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.25}
      />
    </svg>
  )
}

function SparkleSvg({ className }: SvgProps) {
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
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  )
}

function ArrowRightSvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
      />
    </svg>
  )
}

function ChevronDownSvg({ className }: SvgProps) {
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
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  )
}

// Eye with a diagonal slash through it — conveys "private / hidden"
function EyeSlashSvg({ className }: SvgProps) {
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
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  )
}

// Pulse / EKG line — conveys "live real-time signal"
function ActivitySvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <polyline
        points="2,12 5,12 7,5 9.5,19 12,9 14.5,15 16.5,12 22,12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
