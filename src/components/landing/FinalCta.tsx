import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRightSvg } from './icons'
import { useInView } from './use-in-view'

export function FinalCta() {
  const { t } = useTranslation('landing')
  const { ref, inView } = useInView()

  return (
    <section className="relative z-[2] mx-auto max-w-6xl px-6 pb-24 pt-5">
      <div
        ref={ref}
        className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(160deg,#14213f,#0a1124)] px-10 py-14 text-center sm:py-[60px]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,.1), 0 40px 90px -40px rgba(0,0,0,.7)',
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="pointer-events-none absolute -top-28 left-1/2 h-[400px] w-[600px] max-w-[120%] -translate-x-1/2 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(37,99,235,.16),transparent_70%)]" />
        <div className="relative">
          <h2 className="mb-4 text-balance font-display text-[2.25rem] font-extrabold leading-[1.08] tracking-[-0.025em] sm:text-[2.625rem]">
            {t('finalCta.heading')}
          </h2>
          <p className="mx-auto mb-[30px] max-w-[440px] text-[17px] leading-[1.55] text-on-surface-variant">
            {t('finalCta.subheading')}
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2.5 rounded-[13px] bg-primary-container px-[30px] py-4 font-display text-base font-semibold text-on-primary-container shadow-[0_14px_34px_rgba(37,99,235,.3),inset_0_1px_0_rgba(255,255,255,.5)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            {t('finalCta.cta')}
            <ArrowRightSvg className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
