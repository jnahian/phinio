import type { ReactElement } from 'react'
import { BellSvg, CalendarSvg, VaultSvg } from './icons'
import type { SvgProps } from './icons'
import { useInView } from './use-in-view'

interface Step {
  num: string
  Icon: (props: SvgProps) => ReactElement
  title: string
  description: string
}

const steps: Array<Step> = [
  {
    num: '01',
    Icon: VaultSvg,
    title: 'Create your vault',
    description:
      'Sign up in seconds. No credit card, no bank links, no third-party connections.',
  },
  {
    num: '02',
    Icon: CalendarSvg,
    title: 'Add your assets',
    description:
      'Log lump-sum investments, DPS schemes, savings pots, and EMIs. Schedules and amortization tables generate automatically.',
  },
  {
    num: '03',
    Icon: BellSvg,
    title: 'Stay ahead',
    description:
      'Push reminders warn you before due dates. Your dashboard updates live as you mark payments complete.',
  },
]

export function HowItWorks() {
  const { ref, inView } = useInView()

  return (
    <section className="py-24 px-6 bg-surface-container-low">
      <div className="mx-auto max-w-5xl">
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
