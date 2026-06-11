import { useState } from 'react'
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
import {
  INVESTMENT_TYPES,
  dpsCreateSchema,
  investmentCreateSchema,
  savingsCreateSchema,
} from '@phinio/validators'
import { GlassNav } from '#/components/glass'
import { FilterPills } from '#/components/FilterPills'
import { FormField } from '#/components/FormField'
import { useTheme } from '#/theme/use-theme'
import {
  useCreateDps,
  useCreateInvestment,
  useCreateSavings,
} from '#/hooks/useInvestments'

type Mode = 'lump_sum' | 'dps' | 'savings'

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function zodFieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '')
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
  }
  return fieldErrors
}

export default function NewInvestmentScreen() {
  const { t } = useTranslation('investments')
  const { colors } = useTheme()
  const router = useRouter()

  const createInvestment = useCreateInvestment()
  const createDps = useCreateDps()
  const createSavings = useCreateSavings()

  const [mode, setMode] = useState<Mode>('lump_sum')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Shared
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  // Lump sum
  const [type, setType] = useState<string>('stock')
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [dateOfInvestment, setDateOfInvestment] = useState(isoToday())
  const [estimatedClosureDate, setEstimatedClosureDate] = useState('')
  // DPS
  const [monthlyDeposit, setMonthlyDeposit] = useState('')
  const [tenureMonths, setTenureMonths] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [interestType, setInterestType] = useState<'simple' | 'compound'>(
    'compound',
  )
  const [startDate, setStartDate] = useState(isoToday())
  // Savings
  const [startingBalance, setStartingBalance] = useState('')

  const submit = () => {
    if (mode === 'lump_sum') {
      const parsed = investmentCreateSchema.safeParse({
        name,
        type,
        investedAmount,
        currentValue: currentValue || investedAmount,
        dateOfInvestment,
        estimatedClosureDate: estimatedClosureDate || undefined,
        notes: notes || undefined,
      })
      if (!parsed.success) return setErrors(zodFieldErrors(parsed.error.issues))
      createInvestment.mutate(parsed.data)
    } else if (mode === 'dps') {
      const parsed = dpsCreateSchema.safeParse({
        name,
        monthlyDeposit,
        tenureMonths: Number(tenureMonths),
        interestRate,
        interestType,
        startDate,
        notes: notes || undefined,
      })
      if (!parsed.success) return setErrors(zodFieldErrors(parsed.error.issues))
      createDps.mutate(parsed.data)
    } else {
      const parsed = savingsCreateSchema.safeParse({
        name,
        startDate,
        currentValue: startingBalance || '0.00',
        notes: notes || undefined,
      })
      if (!parsed.success) return setErrors(zodFieldErrors(parsed.error.issues))
      createSavings.mutate(parsed.data)
    }
    setErrors({})
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
          <FilterPills
            options={[
              { value: 'lump_sum', label: t('common:tabs.investments') },
              { value: 'dps', label: t('types.dps') },
              { value: 'savings', label: t('types.savings') },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m)
              setErrors({})
            }}
          />

          <FormField
            label={t('form.nameLabel')}
            placeholder={
              mode === 'dps'
                ? t('dps.namePlaceholder')
                : mode === 'savings'
                  ? t('savings.namePlaceholder')
                  : t('form.namePlaceholder')
            }
            value={name}
            onChangeText={setName}
            error={errors.name}
          />

          {mode === 'lump_sum' ? (
            <>
              <View style={styles.typeRow}>
                <Text
                  style={[styles.typeLabel, { color: colors.onSurfaceVariant }]}
                >
                  {t('form.typeLabel')}
                </Text>
                <FilterPills
                  options={INVESTMENT_TYPES.map((value) => ({
                    value,
                    label: t(`types.${value}`, { defaultValue: value }),
                  }))}
                  value={type}
                  onChange={setType}
                />
              </View>
              <FormField
                label={t('form.investedLabel')}
                value={investedAmount}
                onChangeText={setInvestedAmount}
                error={errors.investedAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <FormField
                label={t('form.currentValueLabel')}
                value={currentValue}
                onChangeText={setCurrentValue}
                error={errors.currentValue}
                keyboardType="decimal-pad"
                placeholder={investedAmount || '0.00'}
              />
              <FormField
                label={t('form.dateLabel')}
                value={dateOfInvestment}
                onChangeText={setDateOfInvestment}
                error={errors.dateOfInvestment}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
              <FormField
                label={t('form.estimatedClosureLabel')}
                value={estimatedClosureDate}
                onChangeText={setEstimatedClosureDate}
                error={errors.estimatedClosureDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
            </>
          ) : mode === 'dps' ? (
            <>
              <FormField
                label={t('dps.monthlyLabel')}
                value={monthlyDeposit}
                onChangeText={setMonthlyDeposit}
                error={errors.monthlyDeposit}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <FormField
                label={t('dps.tenureLabel')}
                value={tenureMonths}
                onChangeText={setTenureMonths}
                error={errors.tenureMonths}
                keyboardType="number-pad"
                placeholder="12"
              />
              <FormField
                label={t('dps.interestRateLabel')}
                value={interestRate}
                onChangeText={setInterestRate}
                error={errors.interestRate}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <View style={styles.typeRow}>
                <Text
                  style={[styles.typeLabel, { color: colors.onSurfaceVariant }]}
                >
                  {t('dps.interestTypeLabel')}
                </Text>
                <FilterPills
                  options={[
                    { value: 'compound', label: t('dps.interestCompound') },
                    { value: 'simple', label: t('dps.interestSimple') },
                  ]}
                  value={interestType}
                  onChange={setInterestType}
                />
              </View>
              <FormField
                label={t('dps.startDateLabel')}
                value={startDate}
                onChangeText={setStartDate}
                error={errors.startDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
            </>
          ) : (
            <>
              <FormField
                label={t('savings.startingBalance')}
                value={startingBalance}
                onChangeText={setStartingBalance}
                error={errors.currentValue}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <FormField
                label={t('savings.startDate')}
                value={startDate}
                onChangeText={setStartDate}
                error={errors.startDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
            </>
          )}

          <FormField
            label={t('form.notesLabel')}
            placeholder={
              mode === 'savings'
                ? t('savings.notesPlaceholder')
                : t('form.notesPlaceholder')
            }
            value={notes}
            onChangeText={setNotes}
            error={errors.notes}
            multiline
          />

          <Pressable
            onPress={submit}
            accessibilityRole="button"
            style={[styles.submit, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.submitText, { color: colors.surface }]}>
              {t('form.submit')}
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
