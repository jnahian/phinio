import { Link } from '@tanstack/react-router'
import {
  ArrowRightSvg,
  ChevronDownSvg,
  LockSvg,
  SparkleSvg,
} from './icons'

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-[calc(6rem+env(safe-area-inset-top))] pb-20 overflow-hidden">
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
          <div className="absolute inset-0 rounded-[2rem] bg-primary-container/20 blur-3xl scale-[1.7] animate-lp-glow-pulse" />
          <div
            className="absolute inset-[-16px] rounded-[2.8rem] animate-lp-spin-slow"
            style={{ border: '1px solid rgba(180,197,255,0.09)' }}
          />
          <div
            className="absolute inset-[-30px] rounded-[3.4rem] animate-lp-spin-slow"
            style={{
              border: '1px solid rgba(180,197,255,0.05)',
              animationDuration: '28s',
              animationDirection: 'reverse',
            }}
          />
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
          <div className="absolute -top-3 -right-3 w-9 h-9 bg-secondary rounded-full flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(78,222,163,0.7)]">
            <LockSvg className="w-4 h-4 text-on-secondary" />
          </div>
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
          Lump-sum investments, DPS schemes, savings pots, and EMI
          amortization — unified in one private, encrypted vault. Push
          reminders so you never miss a payment.
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
