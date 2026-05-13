import { ReactNode } from 'react'
import { StyleSheet, Text, View, ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GlassSurface } from './GlassSurface'
import { useTheme } from '#/theme/use-theme'

export type GlassNavProps = ViewProps & {
  title?: string
  leading?: ReactNode
  trailing?: ReactNode
}

/**
 * Top navigation bar. Safe-area aware (uses
 * `useSafeAreaInsets().top` for the status-bar inset). Scroll-tint
 * reactivity is deferred to Phase 3D/4 when real scrolling lists
 * exist — see spec §5.
 */
export function GlassNav({
  title,
  leading,
  trailing,
  style,
  ...rest
}: GlassNavProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  return (
    <GlassSurface style={[{ paddingTop: insets.top }, style]} {...rest}>
      <View style={styles.row}>
        <View style={styles.slot}>{leading}</View>
        <Text
          style={[styles.title, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={[styles.slot, styles.slotEnd]}>{trailing}</View>
      </View>
    </GlassSurface>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  slot: {
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotEnd: {
    justifyContent: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
})
