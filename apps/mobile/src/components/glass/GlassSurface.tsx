import { ReactNode } from 'react'
import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { GlassView, type GlassStyle } from 'expo-glass-effect'
import { useGlassTier, type GlassTier } from '#/lib/glass-tier'
import { useTheme } from '#/theme/use-theme'

export type GlassSurfaceVariant = 'regular' | 'clear'

export type GlassSurfaceProps = ViewProps & {
  /**
   * Liquid Glass variant. Maps directly to `expo-glass-effect`'s
   * `glassEffectStyle`. `clear` is more transparent; `regular` is the
   * default used for most surfaces.
   */
  variant?: GlassSurfaceVariant
  /**
   * Border radius applied to the surface + clipping mask. Defaults to
   * 0 — composites like `GlassCard` set their own (16px per spec).
   */
  borderRadius?: number
  /**
   * Optional tier override — primarily for the demo screen so users
   * can preview tiers other than the resolved one. Production callers
   * should leave this undefined.
   */
  tierOverride?: GlassTier
  children?: ReactNode
}

/**
 * Base glass wrapper. Renders one of three backings driven by
 * `useGlassTier()`. Always renders a `surface-container-low` fill
 * underneath so text has a contrast-correct background when
 * accessibility forces the flat tier (per spec §5).
 *
 * `expo-glass-effect`'s `GlassView` already degrades to a plain
 * `<View>` on platforms where the native module isn't available, so
 * we can import it unconditionally without breaking Android / web
 * bundles.
 */
export function GlassSurface({
  variant = 'regular',
  borderRadius = 0,
  tierOverride,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const resolvedTier = useGlassTier()
  const tier = tierOverride ?? resolvedTier
  const theme = useTheme()

  const containerStyle: ViewStyle = {
    borderRadius,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceContainerLow,
  }

  if (tier === 'liquid') {
    return (
      <View style={[containerStyle, style]} {...rest}>
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle={variant as GlassStyle}
        />
        <View style={styles.content}>{children}</View>
      </View>
    )
  }

  if (tier === 'blur') {
    return (
      <View style={[containerStyle, style]} {...rest}>
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={50}
          tint="dark"
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            // Low-alpha tint so the blur reads as a Modern Noir
            // surface rather than a generic system blur.
            { backgroundColor: theme.colors.surfaceContainerLow, opacity: 0.4 },
          ]}
        />
        <View style={styles.content}>{children}</View>
      </View>
    )
  }

  // flat — solid token, no blur layer.
  return (
    <View style={[containerStyle, style]} {...rest}>
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    position: 'relative',
    zIndex: 1,
  },
})
