import type { ReactElement } from 'react'
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
  title: string
  description: string
  accent: Accent
}

const features: Array<Feature> = [
  {
    Icon: ChartLineSvg,
    title: 'Unified portfolio',
    description:
      'Lump-sum investments, DPS schemes, and flexible savings pots — tracked side by side with automatic return math and per-mode detail views.',
    accent: 'primary',
  },
  {
    Icon: CalendarSvg,
    title: 'EMI amortization',
    description:
      'Full reducing-balance schedules generated upfront for bank loans and credit-card EMIs. Know every payment, principal / interest split, and exact payoff date.',
    accent: 'secondary',
  },
  {
    Icon: BarChartSvg,
    title: 'Net worth dashboard',
    description:
      'Active investments minus outstanding EMI balances, at a glance. Quick stats, upcoming payments, and an interactive allocation donut.',
    accent: 'primary',
  },
  {
    Icon: BellSvg,
    title: 'Push reminders',
    description:
      'Browser push notifications for upcoming and overdue EMI and DPS installments — delivered even when Phinio is closed.',
    accent: 'secondary',
  },
  {
    Icon: HistorySvg,
    title: 'Activity history',
    description:
      'Every create, edit, and delete is logged with before-and-after diffs. A complete audit trail you can scroll through any time.',
    accent: 'primary',
  },
  {
    Icon: ShieldSvg,
    title: 'Privacy first',
    description:
      'No third-party integrations, no tracking, no data sharing. Your financial data stays encrypted and entirely within your control.',
    accent: 'secondary',
  },
]

export function Features() {
  const { ref, inView } = useInView()

  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
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

        <div
          ref={ref}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map(({ Icon, title, description, accent }, i) => {
            const isPrimary = accent === 'primary'
            return (
              <div
                key={title}
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
