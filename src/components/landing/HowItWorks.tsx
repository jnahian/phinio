import { useTranslation } from 'react-i18next'
import { useInView } from './use-in-view'

const stepKeys = ['step1', 'step2', 'step3'] as const

export function HowItWorks() {
  const { t } = useTranslation('landing')
  const { ref, inView } = useInView()

  return (
    <section
      id="how"
      className="relative z-[2] mx-auto max-w-6xl px-6 py-[70px]"
    >
      <div
        ref={ref}
        className="grid items-center gap-12 rounded-[30px] bg-[linear-gradient(160deg,rgba(255,255,255,.04),rgba(255,255,255,.012))] p-8 sm:p-12 lg:grid-cols-2"
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07)',
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Steps */}
        <div>
          <div className="mb-3.5 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-primary">
            {t('howItWorks.label')}
          </div>
          <h2 className="mb-7 font-display text-[2.125rem] font-extrabold leading-[1.12] tracking-[-0.02em]">
            {t('howItWorks.heading')}
          </h2>
          <div className="flex flex-col gap-[22px]">
            {stepKeys.map((key, i) => (
              <div key={key} className="flex gap-4">
                <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] bg-primary-container/15 font-display font-bold text-primary">
                  {i + 1}
                </div>
                <div>
                  <div className="mb-[3px] text-[15.5px] font-semibold">
                    {t(`howItWorks.${key}.title`)}
                  </div>
                  <div className="text-sm leading-[1.55] text-on-surface-variant">
                    {t(`howItWorks.${key}.description`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Illustrative sample cards (decorative, not localized) */}
        <div className="flex flex-col gap-3.5">
          <div
            className="flex items-center justify-between rounded-[18px] bg-[#070c1a]/55 px-5 py-[18px]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}
          >
            <div>
              <div className="text-[13px] text-on-surface-variant">
                DPS · Monthly deposit
              </div>
              <div className="mt-[3px] font-display text-lg font-bold">
                ৳5,000{' '}
                <span className="text-xs font-medium text-outline">
                  / 60 mo
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-outline">Matures at</div>
              <div className="font-display font-bold text-secondary">
                ৳3,86,400
              </div>
            </div>
          </div>

          <div
            className="rounded-[18px] bg-[#070c1a]/55 px-5 py-[18px]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[13px] text-on-surface-variant">
                Home Loan amortization
              </div>
              <div className="text-xs text-outline">42 / 120 paid</div>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full w-[35%] rounded-full bg-[linear-gradient(90deg,#2563eb,#3b78f0)]" />
            </div>
            <div className="mt-[9px] flex justify-between text-[11.5px] text-outline">
              <span>Principal ৳18,40,000</span>
              <span>Remaining ৳11,96,000</span>
            </div>
          </div>

          <div
            className="flex items-center gap-3.5 rounded-[18px] bg-[#070c1a]/55 px-5 py-[18px]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}
          >
            <div
              className="h-2 w-2 flex-shrink-0 rounded-full bg-secondary"
              style={{ boxShadow: '0 0 10px var(--color-secondary)' }}
            />
            <div className="flex-1 text-[13.5px] text-on-surface-variant">
              Stocks position up{' '}
              <span className="font-semibold text-secondary">+12.6%</span> since
              entry
            </div>
            <div className="font-display text-[15px] font-bold">৳1,98,400</div>
          </div>
        </div>
      </div>
    </section>
  )
}
