import { useTranslation } from 'react-i18next'
import { ActivitySvg, EyeSlashSvg, LockSvg } from './icons'
import { useInView } from './use-in-view'

const trustItems = [
  { Icon: EyeSlashSvg, value: '100%', key: 'private' },
  { Icon: LockSvg, value: 'E2E', key: 'encrypted' },
  { Icon: ActivitySvg, value: 'Live', key: 'tracking' },
] as const

export function TrustBar() {
  const { t } = useTranslation('landing')
  const { ref, inView } = useInView()
  return (
    <section className="py-16 px-6 bg-surface-container-low">
      <div
        ref={ref}
        className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-12"
      >
        {trustItems.map(({ Icon, value, key }, i) => (
          <div
            key={key}
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
            <span className="text-sm font-semibold text-primary">
              {t(`trust.${key}Label`)}
            </span>
            <span className="text-xs text-on-surface-variant">
              {t(`trust.${key}Sub`)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
