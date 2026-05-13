import { ReactNode } from 'react'
import { StyleSheet, View, ViewProps } from 'react-native'
import { GlassSurface, type GlassSurfaceVariant } from './GlassSurface'

export type GlassCardProps = ViewProps & {
  variant?: GlassSurfaceVariant
  /** Inner padding. Defaults to 16 (Modern Noir spacing unit). */
  padding?: number
  /** Corner radius. Defaults to 16 (Modern Noir card radius). */
  borderRadius?: number
  children?: ReactNode
}

/**
 * `GlassSurface` + Modern Noir card chrome (16px radius, 16px padding).
 *
 * The padding/radius defaults are hardcoded here because the current
 * `useTheme()` only surfaces color tokens. When the design-tokens
 * package exposes a spacing scale, swap these constants for token
 * references.
 */
export function GlassCard({
  variant,
  padding = 16,
  borderRadius = 16,
  style,
  children,
  ...rest
}: GlassCardProps) {
  return (
    <GlassSurface variant={variant} borderRadius={borderRadius} style={style} {...rest}>
      <View style={[styles.inner, { padding }]}>{children}</View>
    </GlassSurface>
  )
}

const styles = StyleSheet.create({
  inner: {
    width: '100%',
  },
})
