import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '#/lib/cn'

interface PullToRefreshProps {
  threshold?: number
  maxPull?: number
  resistance?: number
}

type Phase = 'idle' | 'pulling' | 'ready' | 'refreshing'

interface GestureState {
  phase: Phase
  startY: number
  startX: number
  claimed: boolean
  pull: number
}

function walkAncestors(
  el: Element | null,
  fn: (n: Element) => boolean,
): boolean {
  for (
    let n: Element | null = el;
    n && n !== document.body;
    n = n.parentElement
  ) {
    if (fn(n)) return true
  }
  return false
}

function shouldSkipTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    )
  ) {
    return true
  }
  if (target.closest('[role="dialog"], [role="alertdialog"]')) return true
  if (target.closest('[data-no-pull-to-refresh]')) return true

  return walkAncestors(target, (n) => {
    const cs = getComputedStyle(n)
    // Fixed-positioned overlays (modals, FAB sheets, BottomTabBar) — most
    // app modals don't carry role="dialog" today, so this catches them
    // structurally instead of relying on author-supplied attributes.
    if (cs.position === 'fixed') return true
    // Horizontally-scrollable children (FilterPills, future charts).
    if (
      (cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
      n.scrollWidth > n.clientWidth
    ) {
      return true
    }
    // Vertically-scrollable children that the user has already scrolled —
    // a downward drag here means "scroll inner back up", not "refresh page"
    // (e.g. EMI amortization list, DPS deposit schedule, NotificationBell).
    if (
      (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
      n.scrollHeight > n.clientHeight &&
      n.scrollTop > 0
    ) {
      return true
    }
    return false
  })
}

export function PullToRefresh({
  threshold = 72,
  maxPull = 96,
  resistance = 2.5,
}: PullToRefreshProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const spinnerRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<GestureState>({
    phase: 'idle',
    startY: 0,
    startX: 0,
    claimed: false,
    pull: 0,
  })
  const phaseRef = useRef<Phase>('idle')
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Suppress Android Chrome's native pull-to-refresh and iOS Safari
    // rubber-banding only while this component is mounted — the unauthenticated
    // marketing/auth routes don't have us, so they keep native behavior.
    const prevOverscroll = document.body.style.overscrollBehaviorY
    document.body.style.overscrollBehaviorY = 'none'

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mql.matches
    const onMqlChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches
    }
    mql.addEventListener('change', onMqlChange)

    const setSpinnerStyle = (
      pull: number,
      opacity: number,
      transition: string | null,
      extraTransform = '',
    ) => {
      const node = spinnerRef.current
      if (!node) return
      node.style.transition = transition ?? 'none'
      node.style.transform =
        `translate3d(-50%, ${pull}px, 0) ${extraTransform}`.trim()
      node.style.opacity = String(opacity)
    }

    const updatePhase = (next: Phase) => {
      phaseRef.current = next
      stateRef.current.phase = next
      setPhase(next)
    }

    const retract = () => {
      setSpinnerStyle(0, 0, 'transform 220ms ease, opacity 220ms ease')
      stateRef.current.pull = 0
      setProgress(0)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current === 'refreshing') return
      if (e.touches.length !== 1) return
      if (window.scrollY > 0) return
      if (shouldSkipTarget(e.target)) return

      const t = e.touches[0]
      stateRef.current = {
        phase: 'idle',
        startY: t.clientY,
        startX: t.clientX,
        claimed: false,
        pull: 0,
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const s = stateRef.current
      if (phaseRef.current === 'refreshing') return
      if (e.touches.length !== 1) return

      const t = e.touches[0]
      const dy = t.clientY - s.startY
      const dx = t.clientX - s.startX

      if (!s.claimed) {
        if (dy <= 0 || Math.abs(dy) <= Math.abs(dx)) return
        if (window.scrollY > 0) return
        s.claimed = true
        updatePhase('pulling')
      }

      if (e.cancelable) e.preventDefault()

      const pull = Math.max(0, Math.min(maxPull, dy / resistance))
      s.pull = pull
      const p = Math.max(0, Math.min(1, pull / threshold))
      setProgress(p)

      const rotation = reducedMotionRef.current ? 0 : pull * 4
      const scale = pull >= threshold && !reducedMotionRef.current ? 1.05 : 1
      setSpinnerStyle(pull, p, null, `rotate(${rotation}deg) scale(${scale})`)

      const wasReady = phaseRef.current === 'ready'
      const isReady = pull >= threshold
      if (isReady && !wasReady) {
        updatePhase('ready')
        if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
      } else if (!isReady && wasReady) {
        updatePhase('pulling')
      }
    }

    const onTouchEnd = async () => {
      const s = stateRef.current
      if (phaseRef.current === 'refreshing') return
      if (!s.claimed) return

      if (phaseRef.current === 'ready') {
        updatePhase('refreshing')
        setSpinnerStyle(
          threshold,
          1,
          'transform 180ms ease, opacity 180ms ease',
          reducedMotionRef.current ? '' : 'rotate(0deg) scale(1)',
        )
        try {
          await Promise.all([
            router.invalidate(),
            queryClient.invalidateQueries(),
          ])
        } catch {
          // Errors surface through TanStack Query's existing error handling.
          // We still want to retract the spinner.
        } finally {
          await new Promise((r) => setTimeout(r, 200))
          retract()
          updatePhase('idle')
          s.claimed = false
        }
      } else {
        retract()
        updatePhase('idle')
        s.claimed = false
      }
    }

    const onTouchCancel = () => {
      const s = stateRef.current
      if (phaseRef.current === 'refreshing') return
      if (!s.claimed) return
      retract()
      updatePhase('idle')
      s.claimed = false
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })

    const unsubscribe = router.subscribe('onResolved', () => {
      const s = stateRef.current
      if (phaseRef.current === 'pulling' || phaseRef.current === 'ready') {
        retract()
        updatePhase('idle')
        s.claimed = false
      }
    })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchCancel)
      mql.removeEventListener('change', onMqlChange)
      unsubscribe()
      document.body.style.overscrollBehaviorY = prevOverscroll
    }
  }, [router, queryClient, threshold, maxPull, resistance])

  if (typeof window === 'undefined') return null

  const ringColor =
    phase === 'ready' || phase === 'refreshing'
      ? 'text-secondary'
      : 'text-primary-fixed-dim'

  const node = (
    <div
      ref={spinnerRef}
      aria-hidden="true"
      style={{
        transform: 'translate3d(-50%, 0, 0)',
        opacity: 0,
        willChange: 'transform, opacity',
      }}
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-50 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high shadow-[0_8px_24px_rgba(0,0,0,0.4)] ring-1 ring-outline-variant"
    >
      <svg
        viewBox="0 0 24 24"
        className={cn(
          'h-6 w-6',
          ringColor,
          phase === 'refreshing' && 'animate-spin',
        )}
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeDasharray="60"
          strokeDashoffset={
            phase === 'refreshing' || phase === 'ready'
              ? 15
              : 60 - 60 * progress
          }
        />
      </svg>
    </div>
  )

  return createPortal(node, document.body)
}
