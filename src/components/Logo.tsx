interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const specs = {
  xs: { icon: 'h-6 w-6 rounded-lg',  text: 'text-sm'  },
  sm: { icon: 'h-7 w-7 rounded-xl',  text: 'text-sm'  },
  md: { icon: 'h-8 w-8 rounded-xl',  text: 'text-base' },
  lg: { icon: 'h-10 w-10 rounded-2xl', text: 'text-xl' },
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const { icon, text } = specs[size]
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Square icon mark — overflow-hidden + object-cover centres the glyph
          and clips the grey background to the rounded container */}
      <div className={`${icon} overflow-hidden flex-shrink-0`}>
        <img
          src="/phinio-square.png"
          alt=""
          aria-hidden
          className="h-full w-full object-cover"
        />
      </div>
      <span className={`font-display font-bold tracking-tight text-on-surface ${text}`}>
        Phinio
      </span>
    </div>
  )
}
