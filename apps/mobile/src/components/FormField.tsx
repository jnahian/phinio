import { StyleSheet, Text, TextInput, View } from 'react-native'
import type { TextInputProps } from 'react-native'
import { useTheme } from '#/theme/use-theme'

export type FormFieldProps = TextInputProps & {
  label: string
  error?: string
}

/**
 * Labeled text input on a recessed `surface-container-lowest` fill, per
 * Modern Noir's input treatment. Spread native TextInput props for
 * keyboard type, placeholder, etc.
 */
export function FormField({ label, error, style, ...rest }: FormFieldProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.onSurfaceVariant}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: error ? colors.tertiary : colors.outlineVariant,
            color: colors.onSurface,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.tertiary }]}>{error}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: {
    fontSize: 12,
  },
})
