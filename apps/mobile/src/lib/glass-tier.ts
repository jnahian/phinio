import { useEffect, useMemo, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

/**
 * Glass rendering tier — see `docs/superpowers/specs/2026-05-12-rn-mobile-app-design.md` §5.
 *
 * - `liquid` → `expo-glass-effect` `GlassView`. iOS 26+, transparency allowed.
 * - `blur`   → `expo-blur` `BlurView` + tinted overlay. iOS < 26, Android, web.
 * - `flat`   → solid surface token. Reduce-transparency accessibility flag.
 */
export type GlassTier = 'liquid' | 'blur' | 'flat'

export type ResolveGlassTierInput = {
  os: typeof Platform.OS
  /**
   * `Platform.Version` is `number` on iOS, `number` on Android (API
   * level), and `undefined` on web. We accept the raw value and coerce
   * via `Number(...)` so callers don't have to.
   */
  version: number | string | undefined
  reduceTransparency: boolean
}

/**
 * Pure tier resolver. Kept separate from the hook so tests can exercise
 * every code path without spinning up a React renderer.
 *
 * Priority order:
 *   1. Reduce-transparency forces `flat` regardless of platform — the
 *      accessibility setting overrides everything else per spec §5.
 *   2. iOS 26+ → `liquid`.
 *   3. Everything else (iOS < 26, Android, web) → `blur`.
 */
export function resolveGlassTier(input: ResolveGlassTierInput): GlassTier {
  if (input.reduceTransparency) return 'flat'
  if (input.os === 'ios' && Number(input.version) >= 26) return 'liquid'
  return 'blur'
}

/**
 * Hook wrapper. Subscribes to runtime changes of the reduce-transparency
 * accessibility flag so the tier can switch live without a remount.
 */
export function useGlassTier(): GlassTier {
  const [reduceTransparency, setReduceTransparency] = useState(false)

  useEffect(() => {
    let active = true

    AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (active) setReduceTransparency(value)
    })

    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (value) => {
        setReduceTransparency(value)
      },
    )

    return () => {
      active = false
      sub.remove()
    }
  }, [])

  return useMemo(
    () =>
      resolveGlassTier({
        os: Platform.OS,
        version: Platform.Version,
        reduceTransparency,
      }),
    [reduceTransparency],
  )
}
