import { ReactNode } from 'react'
import { StyleSheet, Text, View, ViewProps } from 'react-native'
import { GlassSurface } from './GlassSurface'
import { useTheme } from '#/theme/use-theme'

export type GlassPillTone = 'neutral' | 'gain' | 'loss'

export type GlassPillProps = ViewProps & {
  /**
   * Tone drives the foreground/text color. Per Modern Noir, gains use
   * `secondary`, losses use `tertiary` — never large background washes.
   */
  tone?: GlassPillTone
  /** Convenience: render plain text. Pass `children` for richer content. */
  label?: string
  children?: ReactNode
}

/**
 * Small chip / money pill. Composed from `GlassSurface` so it picks up
 * the resolved tier automatically. Used for gain/loss indicators,
 * status chips, etc.
 */
export function GlassPill({
  tone = 'neutral',
  label,
  children,
  style,
  ...rest
}: GlassPillProps) {
  const { colors } = useTheme()
  const toneColor =
    tone === 'gain'
      ? colors.secondary
      : tone === 'loss'
        ? colors.tertiary
        : colors.onSurfaceVariant

  return (
    <GlassSurface borderRadius={999} style={[styles.pill, style]} {...rest}>
      <View style={styles.inner}>
        {label !== undefined ? (
          <Text style={[styles.label, { color: toneColor }]}>{label}</Text>
        ) : (
          children
        )}
      </View>
    </GlassSurface>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
  },
  inner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
})
