export interface SvgProps {
  className?: string
  animated?: boolean
}

export function VaultSvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
      />
    </svg>
  )
}

export function LockSvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

export function ShieldSvg({ className, animated }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M12 2.25c-5.25 0-9 3.75-9 3.75S3.75 18 12 21.75C20.25 18 20.25 6 20.25 6S16.5 2.25 12 2.25z"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 1s ease 0.1s' : 'none',
        }}
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M9 12.75L11.25 15 15 9.75"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.6s ease 0.9s' : 'none',
        }}
      />
    </svg>
  )
}

export function ChartLineSvg({ className, animated }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <polyline
        points="3,18 8,11.5 13,14.5 21,6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 1.2s ease 0.2s' : 'none',
        }}
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M17.5 6H21v3.5"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.5s ease 1.2s' : 'none',
        }}
      />
      <line
        x1="3"
        y1="21"
        x2="21"
        y2="21"
        strokeLinecap="round"
        strokeOpacity="0.25"
      />
    </svg>
  )
}

export function CalendarSvg({ className, animated }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2"
        pathLength="1"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.9s ease 0.1s' : 'none',
        }}
      />
      <line
        x1="3"
        y1="9"
        x2="21"
        y2="9"
        strokeLinecap="round"
        strokeOpacity={animated ? 1 : 0}
        style={{
          transition: animated ? 'stroke-opacity 0.3s ease 0.8s' : 'none',
        }}
      />
      <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
      <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
      <path
        strokeLinecap="round"
        pathLength="1"
        d="M12 12.5v5M10 13.5h3a1.5 1.5 0 010 3h-2a1.5 1.5 0 000 3h3"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.7s ease 0.9s' : 'none',
        }}
      />
    </svg>
  )
}

export function BarChartSvg({ className, animated }: SvgProps) {
  const bars = [
    { x: 3, h: 10, y: 11, delay: 0.2 },
    { x: 9, h: 15, y: 6, delay: 0.35 },
    { x: 15, h: 7, y: 14, delay: 0.5 },
  ]
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
    >
      {bars.map(({ x, h, y, delay }) => (
        <rect
          key={x}
          x={x}
          y={y}
          width={5}
          height={h}
          rx={1.5}
          fill="currentColor"
          opacity={0.85}
          style={{
            transformOrigin: `${x + 2.5}px 21px`,
            transform: animated ? 'scaleY(1)' : 'scaleY(0)',
            transition: animated
              ? `transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay}s`
              : 'none',
          }}
        />
      ))}
      <line
        x1="2"
        y1="21"
        x2="22"
        y2="21"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.25}
      />
    </svg>
  )
}

export function SparkleSvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  )
}

export function ArrowRightSvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
      />
    </svg>
  )
}

export function ChevronDownSvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  )
}

export function EyeSlashSvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  )
}

export function ActivitySvg({ className }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <polyline
        points="2,12 5,12 7,5 9.5,19 12,9 14.5,15 16.5,12 22,12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BellSvg({ className, animated }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 1.1s ease 0.15s' : 'none',
        }}
      />
    </svg>
  )
}

export function HistorySvg({ className, animated }: SvgProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M3 12a9 9 0 109-9m-9 9h4.5M3 12V7.5"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 1s ease 0.1s' : 'none',
        }}
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        d="M12 7.5V12l3 1.75"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: animated ? 0 : 1,
          transition: animated ? 'stroke-dashoffset 0.6s ease 0.9s' : 'none',
        }}
      />
    </svg>
  )
}
