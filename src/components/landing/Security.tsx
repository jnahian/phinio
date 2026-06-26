import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useInView } from './use-in-view'

interface Card {
  key: 'scoping' | 'sessions' | 'identity' | 'audit'
  icon: ReactNode
}

const cards: Array<Card> = [
  {
    key: 'scoping',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"
          stroke="#4edea3"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="#4edea3"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: 'sessions',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="4"
          y="10"
          width="16"
          height="11"
          rx="2.5"
          stroke="#b4c5ff"
          strokeWidth="1.7"
        />
        <path d="M8 10V7a4 4 0 018 0v3" stroke="#b4c5ff" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    key: 'identity',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2.5"
          stroke="#b4c5ff"
          strokeWidth="1.7"
        />
        <path
          d="M4 7l8 6 8-6"
          stroke="#b4c5ff"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: 'audit',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"
          stroke="#b4c5ff"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

export function Security() {
  const { t } = useTranslation('landing')
  const { ref, inView } = useInView()

  return (
    <section
      id="security"
      className="relative z-[2] mx-auto max-w-6xl px-6 pb-[70px] pt-[50px]"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-3.5 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-primary">
            {t('security.label')}
          </div>
          <h2 className="mb-4 font-display text-[2.375rem] font-extrabold leading-tight tracking-[-0.025em]">
            {t('security.heading')}
          </h2>
          <p className="text-base leading-[1.65] text-on-surface-variant">
            {t('security.intro')}
          </p>
        </div>

        <div ref={ref} className="grid gap-3.5 sm:grid-cols-2">
          {cards.map(({ key, icon }, i) => (
            <div
              key={key}
              className="rounded-[20px] bg-white/[0.025] p-[22px]"
              style={{
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 90}ms, transform 0.5s ease ${i * 90}ms`,
              }}
            >
              <div className="mb-3.5">{icon}</div>
              <div className="mb-[5px] font-display text-[15.5px] font-bold">
                {t(`security.${key}.title`)}
              </div>
              <div className="text-[13px] leading-[1.5] text-on-surface-variant">
                {t(`security.${key}.description`)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
