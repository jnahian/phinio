import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChartSvg,
  BellSvg,
  CalendarSvg,
  ChartLineSvg,
  HistorySvg,
  ShieldSvg,
} from './icons'
import type { SvgProps } from './icons'
import { useInView } from './use-in-view'

type Accent = 'primary' | 'secondary'

interface Feature {
  Icon: (props: SvgProps) => ReactElement
  key: string
  accent: Accent
}

const features: Array<Feature> = [
  { Icon: ChartLineSvg, key: 'portfolio', accent: 'primary' },
  { Icon: CalendarSvg, key: 'amortization', accent: 'secondary' },
  { Icon: BarChartSvg, key: 'networth', accent: 'primary' },
  { Icon: BellSvg, key: 'reminders', accent: 'secondary' },
  { Icon: HistorySvg, key: 'audit', accent: 'primary' },
  { Icon: ShieldSvg, key: 'privacy', accent: 'secondary' },
]

export function Features() {
  const { t } = useTranslation('landing')
  const { ref, inView } = useInView()

  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <span
            className="label-sm text-primary"
            style={{ letterSpacing: '0.16em' }}
          >
            {t('features.label')}
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-on-surface tracking-tight mt-3 leading-snug">
            {t('features.heading')}
          </h2>
        </div>

        <div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map(({ Icon, key, accent }, i) => {
            const isPrimary = accent === 'primary'
            return (
              <div
                key={key}
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(28px)',
                  transition: `opacity 0.55s ease ${i * 110}ms, transform 0.55s ease ${i * 110}ms`,
                }}
              >
                <div
                  className="group relative h-full p-7 rounded-2xl bg-surface-container-high cursor-default overflow-hidden hover:-translate-y-1 transition-all duration-300"
                  style={{ border: '1px solid rgba(67,70,85,0.18)' }}
                >
                  <div
                    className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                      isPrimary ? 'bg-primary-container/12' : 'bg-secondary/10'
                    }`}
                  />

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
                    {t(`features.${key}.title`)}
                  </h3>
                  <p className="body-sm text-on-surface-variant leading-relaxed">
                    {t(`features.${key}.description`)}
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
