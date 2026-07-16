import { Link } from '@tanstack/react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowRightSvg } from './icons'
import { PhoneMockup } from './PhoneMockup'

export function Hero() {
  const { t } = useTranslation('landing')
  const stats = t('hero.stats', { returnObjects: true }) as Array<{
    value: string
    label: string
  }>

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-[calc(7rem+env(safe-area-inset-top))]">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-56 left-1/2 h-[760px] w-[1100px] max-w-[120vw] -translate-x-1/2 bg-[radial-gradient(60%_60%_at_50%_30%,rgba(180,197,255,.16),transparent_70%)] blur-lg" />
        <div className="absolute -right-40 top-28 h-[620px] w-[620px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(37,99,235,.10),transparent_70%)]" />
      </div>

      <div className="relative z-[2] mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        {/* Copy column */}
        <div className="text-center lg:text-left">
          <div
            className="mb-6 inline-flex items-center gap-2.5 rounded-full bg-white/[0.045] py-[7px] pl-[9px] pr-3.5"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07)' }}
          >
            <span
              className="h-[7px] w-[7px] rounded-full bg-secondary"
              style={{ boxShadow: '0 0 10px var(--color-secondary)' }}
            />
            <span className="text-[12.5px] font-medium text-on-surface-variant">
              {t('hero.eyebrow')}
            </span>
          </div>

          <h1 className="mx-auto max-w-xl text-balance font-display text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-[3.25rem] lg:mx-0 lg:text-[3.6rem]">
            <Trans
              t={t}
              i18nKey="hero.headline"
              components={{
                own: <span className="text-secondary" />,
                owe: <span className="text-primary" />,
              }}
            />
          </h1>

          <p className="mx-auto mt-5 max-w-[480px] text-[17.5px] leading-relaxed text-on-surface-variant lg:mx-0">
            {t('hero.subheading')}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 lg:justify-start">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2.5 rounded-[13px] bg-primary-container px-[26px] py-[15px] font-display text-[15.5px] font-semibold text-on-primary-container shadow-[0_14px_34px_rgba(37,99,235,.26),inset_0_1px_0_rgba(255,255,255,.5)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              {t('hero.ctaPrimary')}
              <ArrowRightSvg className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2.5 rounded-[13px] bg-white/5 px-6 py-[15px] font-display text-[15.5px] font-medium text-on-surface transition-transform duration-200 hover:-translate-y-0.5"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
              </svg>
              {t('hero.ctaSecondary')}
            </a>
          </div>

          {/* Stats */}
          <div className="mt-10 flex items-center justify-center gap-6 lg:justify-start">
            {stats.map((s, i) => (
              <div key={s.label} className="flex items-center gap-6">
                {i > 0 && (
                  <div className="h-[30px] w-px bg-[linear-gradient(transparent,rgba(255,255,255,.12),transparent)]" />
                )}
                <div className="text-left">
                  <div className="font-display text-[22px] font-bold">
                    {s.value}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-outline">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phone column */}
        <PhoneMockup />
      </div>
    </section>
  )
}
