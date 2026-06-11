import { useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { emiCreateSchema } from '@phinio/validators'
import { calculateEmi } from '@phinio/calc'
import { GlassNav } from '#/components/glass'
import { FilterPills } from '#/components/FilterPills'
import { FormField } from '#/components/FormField'
import { useTheme } from '#/theme/use-theme'
import { useCreateEmi } from '#/hooks/useEmis'
import { useMoney } from '#/hooks/useMoney'

type EmiType = 'bank_loan' | 'credit_card'

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function NewEmiScreen() {
  const { t } = useTranslation('emis')
  const { colors } = useTheme()
  const router = useRouter()
  const { money } = useMoney()
  const createEmi = useCreateEmi()

  const [label, setLabel] = useState('')
  const [type, setType] = useState<EmiType>('bank_loan')
  const [principal, setPrincipal] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [tenureMonths, setTenureMonths] = useState('')
  const [startDate, setStartDate] = useState(isoToday())
  const [processingFee, setProcessingFee] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Live monthly-EMI preview once the three core inputs parse.
  const preview = useMemo(() => {
    const months = Number(tenureMonths)
    if (!principal || !interestRate || !Number.isInteger(months) || months < 1)
      return null
    try {
      return calculateEmi({
        principal,
        annualRate: interestRate,
        tenureMonths: months,
        type,
      })
    } catch {
      return null
    }
  }, [principal, interestRate, tenureMonths, type])

  const submit = () => {
    const parsed = emiCreateSchema.safeParse({
      label,
      type,
      principal,
      interestRate,
      tenureMonths: Number(tenureMonths),
      startDate,
      processingFee: processingFee || undefined,
      notes: notes || undefined,
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '')
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    // Offline-first: fire and navigate back immediately — the optimistic
    // list row is already in the cache, and the mutation queues if offline.
    createEmi.mutate(parsed.data)
    router.back()
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav title={t('form.newTitle')} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <FormField
            label={t('form.labelLabel')}
            placeholder={t('form.labelPlaceholder')}
            value={label}
            onChangeText={setLabel}
            error={errors.label}
            autoFocus
          />
          <View style={styles.typeRow}>
            <Text style={[styles.typeLabel, { color: colors.onSurfaceVariant }]}>
              {t('form.typeLabel')}
            </Text>
            <FilterPills
              options={[
                { value: 'bank_loan', label: t('types.bank_loan') },
                { value: 'credit_card', label: t('types.credit_card') },
              ]}
              value={type}
              onChange={setType}
            />
          </View>
          <FormField
            label={t('form.principalLabel')}
            value={principal}
            onChangeText={setPrincipal}
            error={errors.principal}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <FormField
            label={t('form.rateLabel')}
            value={interestRate}
            onChangeText={setInterestRate}
            error={errors.interestRate}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <FormField
            label={t('form.tenureLabel')}
            value={tenureMonths}
            onChangeText={setTenureMonths}
            error={errors.tenureMonths}
            keyboardType="number-pad"
            placeholder="12"
          />
          <FormField
            label={t('form.startDateLabel')}
            value={startDate}
            onChangeText={setStartDate}
            error={errors.startDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <FormField
            label={t('form.feeLabel')}
            value={processingFee}
            onChangeText={setProcessingFee}
            error={errors.processingFee}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <FormField
            label={t('form.section.notes')}
            placeholder={t('form.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            error={errors.notes}
            multiline
          />

          {preview ? (
            <View
              style={[
                styles.preview,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text style={[styles.previewLabel, { color: colors.onSurfaceVariant }]}>
                {t('form.monthlyEmi')}
              </Text>
              <Text style={[styles.previewValue, { color: colors.onSurface }]}>
                {money(preview.emiAmount)}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={createEmi.isPending}
            accessibilityRole="button"
            style={[styles.submit, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.submitText, { color: colors.surface }]}>
              {createEmi.isPending ? t('form.submitting') : t('form.submit')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 120,
  },
  typeRow: {
    gap: 6,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  preview: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 13,
  },
  previewValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  submit: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
