import { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { GlassSurface } from './GlassSurface'
import { useTheme } from '#/theme/use-theme'

export type GlassFABProps = {
  /** Primary action handler. */
  onPress?: () => void
  /** Optional custom icon. Defaults to a `+` glyph. */
  icon?: ReactNode
  accessibilityLabel?: string
}

/**
 * Floating action button. Spec §5 references a "radial menu" mirroring
 * web's `FABMenu` — that's stubbed for 3C; only a single primary
 * action is wired here. Real radial expansion will land alongside the
 * mutation screens in Phase 4.
 */
export function GlassFAB({
  onPress,
  icon,
  accessibilityLabel = 'Primary action',
}: GlassFABProps) {
  const { colors } = useTheme()

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.pressable,
          pressed ? { opacity: 0.8 } : null,
        ]}
      >
        <GlassSurface borderRadius={28} style={styles.surface}>
          <View
            style={[
              styles.inner,
              { backgroundColor: colors.primary, borderRadius: 28 },
            ]}
          >
            {icon ?? (
              <Text style={[styles.plus, { color: colors.onPrimary }]}>+</Text>
            )}
          </View>
        </GlassSurface>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
  pressable: {
    width: 56,
    height: 56,
  },
  surface: {
    width: 56,
    height: 56,
  },
  inner: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
})
