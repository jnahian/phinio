import { forwardRef, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { KeyboardTypeOptions } from 'react-native'
import { GlassSheet, type GlassSheetHandle } from '#/components/glass'
import { FormField } from '#/components/FormField'
import { useTheme } from '#/theme/use-theme'

export type FormSheetField = {
  key: string
  label: string
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  initialValue?: string
}

export type FormSheetConfig = {
  title: string
  fields: FormSheetField[]
  submitLabel: string
  /**
   * Return a map of field-key → error message to keep the sheet open, or
   * null/undefined to accept. Caller performs the actual mutation.
   */
  onSubmit: (values: Record<string, string>) => Record<string, string> | null | void
}

/**
 * Small dynamic form in a glass bottom sheet — covers the one-shot
 * action forms (withdraw, add deposit, close DPS, complete investment)
 * without a dedicated screen per action.
 */
export const FormSheet = forwardRef<
  GlassSheetHandle,
  { config: FormSheetConfig | null; onDone: () => void }
>(function FormSheet({ config, onDone }, ref) {
  const { colors } = useTheme()
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!config) return
    const initial: Record<string, string> = {}
    for (const f of config.fields) initial[f.key] = f.initialValue ?? ''
    setValues(initial)
    setErrors({})
  }, [config])

  if (!config) return <GlassSheet ref={ref} />

  const submit = () => {
    const result = config.onSubmit(values)
    if (result && Object.keys(result).length > 0) {
      setErrors(result)
      return
    }
    onDone()
  }

  return (
    <GlassSheet ref={ref} snapPoints={['60%', '90%']}>
      <Text style={[styles.title, { color: colors.onSurface }]}>
        {config.title}
      </Text>
      <View style={styles.fields}>
        {config.fields.map((f) => (
          <FormField
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            keyboardType={f.keyboardType}
            value={values[f.key] ?? ''}
            onChangeText={(text) =>
              setValues((prev) => ({ ...prev, [f.key]: text }))
            }
            error={errors[f.key]}
            autoCapitalize="none"
          />
        ))}
      </View>
      <Pressable
        onPress={submit}
        accessibilityRole="button"
        style={[styles.submit, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.submitText, { color: colors.surface }]}>
          {config.submitLabel}
        </Text>
      </Pressable>
    </GlassSheet>
  )
})

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  fields: {
    gap: 12,
  },
  submit: {
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
