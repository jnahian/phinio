import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useInView } from './use-in-view'

interface Card {
  key: 'portfolio' | 'emi' | 'dashboard'
  iconBg: string
  icon: ReactNode
}

const cards: Array<Card> = [
  {
    key: 'portfolio',
    iconBg: 'rgba(78,222,163,.12)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16l5-5 4 4 7-8"
          stroke="#4edea3"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 7h4v4"
          stroke="#4edea3"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: 'emi',
    iconBg: 'rgba(255,218,215,.12)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2.5"
          stroke="#ffdad7"
          strokeWidth="1.8"
        />
        <path
          d="M3 9.5h18M7 15h5"
          stroke="#ffdad7"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: 'dashboard',
    iconBg: 'rgba(180,197,255,.12)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke="#b4c5ff" strokeWidth="1.8" />
        <path d="M12 12V4.5A7.5 7.5 0 0119 10.5L12 12z" fill="#b4c5ff" />
      </svg>
    ),
  },
]

export function Features() {
  const { t } = useTranslation('landing')
  const { ref, inView } = useInView()

  return (
    <section
      id="features"
      className="relative z-[2] mx-auto max-w-6xl px-6 pb-10 pt-8"
    >
      <div className="mb-11 max-w-[620px]">
        <div className="mb-3.5 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-primary">
          {t('features.label')}
        </div>
        <h2 className="mb-4 font-display text-[2.5rem] font-extrabold leading-tight tracking-[-0.025em]">
          {t('features.heading')}
        </h2>
        <p className="text-base leading-relaxed text-on-surface-variant">
          {t('features.intro')}
        </p>
      </div>

      <div ref={ref} className="grid gap-[18px] md:grid-cols-3">
        {cards.map(({ key, iconBg, icon }, i) => {
          const bullets = t(`features.${key}.bullets`, {
            returnObjects: true,
          }) as Array<string>
          return (
            <div
              key={key}
              className="group rounded-[22px] bg-white/[0.025] p-[26px] transition-transform duration-300 hover:-translate-y-1.5 hover:bg-white/[0.045]"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.5s ease ${i * 110}ms, transform 0.5s ease ${i * 110}ms`,
              }}
            >
              <div
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px]"
                style={{ background: iconBg }}
              >
                {icon}
              </div>
              <h3 className="mb-2.5 font-display text-[19px] font-bold">
                {t(`features.${key}.title`)}
              </h3>
              <p className="mb-4 text-[14.5px] leading-relaxed text-on-surface-variant">
                {t(`features.${key}.description`)}
              </p>
              <div className="flex flex-col gap-2.5">
                {bullets.map((b) => (
                  <div
                    key={b}
                    className="flex items-center gap-2.5 text-[13px] text-on-surface-variant"
                  >
                    <span className="text-secondary">✓</span>
                    {b}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
