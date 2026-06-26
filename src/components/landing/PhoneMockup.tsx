import { useState } from 'react'

// Decorative dashboard illustration for the hero. All figures are sample
// data, not localized — only the surrounding marketing copy routes through
// i18n (see the project rule on mockups being reference material).
interface Segment {
  name: string
  pct: number
  color: string
  val: string
}

const SEGMENTS: Array<Segment> = [
  { name: 'Stocks', pct: 32, color: '#2563eb', val: '৳19.9L' },
  { name: 'Mutual funds', pct: 24, color: '#4edea3', val: '৳15.0L' },
  { name: 'Gold', pct: 18, color: '#b4c5ff', val: '৳11.2L' },
  { name: 'Real estate', pct: 14, color: '#8a9bd8', val: '৳8.7L' },
  { name: 'Crypto', pct: 12, color: '#e6a98c', val: '৳7.5L' },
]

function buildGradient(active: string | null) {
  let acc = 0
  const stops = SEGMENTS.map((s) => {
    const start = acc
    acc += s.pct * 3.6
    const dim = active != null && active !== s.name
    const col = dim ? 'rgba(255,255,255,.07)' : s.color
    return `${col} ${start}deg ${acc}deg`
  })
  return `conic-gradient(from -90deg, ${stops.join(',')})`
}

function AllocationDonut() {
  const [active, setActive] = useState<string | null>(null)
  const current = SEGMENTS.find((s) => s.name === active)

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-24 w-24 flex-shrink-0 rounded-full"
        style={{
          background: buildGradient(active),
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.04)',
          transition: 'background .3s ease',
        }}
      >
        <div className="absolute inset-[23px] flex flex-col items-center justify-center rounded-full bg-surface">
          <div className="font-display text-[15px] font-extrabold">
            {current ? current.val : '৳62.4L'}
          </div>
          <div className="mt-px text-[8.5px] text-outline">
            {current ? current.name : 'invested'}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {SEGMENTS.map((s) => {
          const dim = active != null && active !== s.name
          return (
            <div
              key={s.name}
              onMouseEnter={() => setActive(s.name)}
              onMouseLeave={() => setActive(null)}
              className="flex items-center gap-2"
              style={{
                opacity: dim ? 0.4 : 1,
                transform: active === s.name ? 'translateX(2px)' : 'none',
                transition: 'opacity .25s ease, transform .25s ease',
              }}
            >
              <span
                className="h-2 w-2 flex-shrink-0 rounded-[3px]"
                style={{ background: s.color }}
              />
              <span className="flex-1 text-[11px] text-on-surface-variant">
                {s.name}
              </span>
              <span className="font-display text-[11px] font-bold text-on-surface">
                {s.pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PhoneMockup() {
  return (
    <div className="flex justify-center">
      <div className="animate-lp-float w-full max-w-[330px]">
        <div
          className="rounded-[42px] p-[11px]"
          style={{
            background: 'linear-gradient(160deg,#1b264a,#0a1124)',
            boxShadow:
              '0 50px 90px -30px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.14), 0 0 0 1px rgba(255,255,255,.04)',
          }}
        >
          <div
            className="relative overflow-hidden rounded-[33px] bg-surface"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.03)' }}
          >
            {/* notch */}
            <div className="absolute left-1/2 top-3 z-[3] h-[26px] w-24 -translate-x-1/2 rounded-full bg-[#05080f]" />

            <div className="px-5 pb-[22px] pt-[46px]">
              {/* topbar */}
              <div className="mb-[22px] flex items-center justify-between">
                <div>
                  <div className="text-[11.5px] text-outline">
                    Good evening,
                  </div>
                  <div className="font-display text-base font-bold">Arif</div>
                </div>
                <div className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-white/5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"
                      stroke="#cdd6ee"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full bg-primary"
                    style={{ boxShadow: '0 0 0 2px var(--color-surface)' }}
                  />
                </div>
              </div>

              {/* net worth */}
              <div
                className="mb-3.5 rounded-[20px] p-[18px]"
                style={{
                  background:
                    'linear-gradient(155deg,rgba(180,197,255,.13),rgba(180,197,255,.02))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)',
                }}
              >
                <div className="flex items-center gap-[7px] text-[11.5px] text-on-surface-variant">
                  Net worth
                  <span className="inline-flex items-center gap-[3px] rounded-full bg-secondary/15 px-[7px] py-0.5 text-[10.5px] font-semibold text-secondary">
                    ▲ 8.4%
                  </span>
                </div>
                <div className="mt-1.5 font-display text-[32px] font-extrabold tracking-[-.02em]">
                  ৳48,20,640
                </div>
                <div className="mt-[3px] text-[11px] text-outline">
                  Assets ৳62,40,000 · Liabilities ৳14,19,360
                </div>
              </div>

              {/* allocation */}
              <div
                className="mb-3.5 rounded-[20px] bg-white/[0.035] p-4"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}
              >
                <div className="mb-3 text-[11.5px] font-medium text-on-surface-variant">
                  Allocation
                </div>
                <AllocationDonut />
              </div>

              {/* upcoming emi */}
              <div
                className="flex items-center gap-3 rounded-[18px] bg-white/[0.035] px-[15px] py-3.5"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)' }}
              >
                <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px] bg-tertiary-fixed/15">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="6"
                      width="18"
                      height="13"
                      rx="2.5"
                      stroke="#ffdad7"
                      strokeWidth="1.7"
                    />
                    <path d="M3 10h18" stroke="#ffdad7" strokeWidth="1.7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] font-medium">
                    Car Loan · EMI 14/60
                  </div>
                  <div className="mt-px text-[10.5px] font-medium text-error">
                    Due in 3 days
                  </div>
                </div>
                <div className="font-display text-[14.5px] font-bold">
                  ৳24,180
                </div>
              </div>
            </div>

            {/* tabbar */}
            <div
              className="flex justify-around bg-[#070c1a]/50 px-6 pb-[18px] pt-3.5"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 11l9-7 9 7v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z"
                  stroke="#b4c5ff"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 19V9m5 10V5m5 14v-7m5 7V8"
                  stroke="#5e6b8a"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              </svg>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="6"
                  width="18"
                  height="13"
                  rx="2.5"
                  stroke="#5e6b8a"
                  strokeWidth="1.7"
                />
              </svg>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="8"
                  r="3.5"
                  stroke="#5e6b8a"
                  strokeWidth="1.7"
                />
                <path
                  d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"
                  stroke="#5e6b8a"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
