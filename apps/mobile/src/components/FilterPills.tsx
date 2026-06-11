import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useTheme } from '#/theme/use-theme'

export type FilterPillOption<V extends string> = {
  value: V
  label: string
}

export type FilterPillsProps<V extends string> = {
  options: readonly FilterPillOption<V>[]
  value: V
  onChange: (value: V) => void
}

/**
 * Horizontal filter chips driving list query inputs. Flat (not glass) —
 * chips are secondary chrome and the glass budget belongs to the nav,
 * tab bar, and content container.
 */
export function FilterPills<V extends string>({
  options,
  value,
  onChange,
}: FilterPillsProps<V>) {
  const { colors } = useTheme()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.pill,
              {
                backgroundColor: selected
                  ? colors.primaryContainer
                  : colors.surfaceContainerLow,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? colors.onSurface : colors.onSurfaceVariant,
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
})
