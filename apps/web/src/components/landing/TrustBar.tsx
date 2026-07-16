import { useTranslation } from 'react-i18next'
import { useInView } from './use-in-view'

export function TrustBar() {
  const { t } = useTranslation('landing')
  const { ref, inView } = useInView()
  const items = t('assets.items', { returnObjects: true }) as Array<string>

  return (
    <section className="relative z-[2] mx-auto max-w-5xl px-6 pb-20 pt-1.5">
      <div className="mb-[22px] text-center text-xs uppercase tracking-[0.14em] text-outline">
        {t('assets.title')}
      </div>
      <div ref={ref} className="flex flex-wrap justify-center gap-3">
        {items.map((label, i) => (
          <span
            key={label}
            className="rounded-full bg-white/[0.04] px-4 py-[9px] text-[13.5px] text-on-surface-variant"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(12px)',
              transition: `opacity 0.45s ease ${i * 50}ms, transform 0.45s ease ${i * 50}ms`,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
