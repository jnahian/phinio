import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SymbolView } from 'expo-symbols'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { isFeePayment } from '@phinio/calc'
import { GlassNav, GlassPill } from '#/components/glass'
import { ErrorState, LoadingState } from '#/components/ScreenState'
import { useTheme } from '#/theme/use-theme'
import { useEmiQuery } from '#/hooks/useEmis'
import { useMoney } from '#/hooks/useMoney'

function BackButton() {
  const router = useRouter()
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      hitSlop={8}
    >
      {Platform.OS === 'ios' ? (
        <SymbolView
          name="chevron.left"
          size={20}
          tintColor={colors.onSurface}
          fallback={
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          }
        />
      ) : (
        <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
      )}
    </Pressable>
  )
}

export default function EmiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useTranslation('emis')
  const { colors } = useTheme()
  const { money, date } = useMoney()

  const detail = useEmiQuery(id ?? '')
  const emi = detail.data

  const regularPayments = emi?.payments.filter((p) => !isFeePayment(p)) ?? []
  const feeRow = emi?.payments.find((p) => isFeePayment(p))

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav title={emi?.label ?? ''} leading={<BackButton />} />
      {detail.isPending && !emi ? (
        <LoadingState />
      ) : detail.isError && !emi ? (
        <ErrorState
          message={t('detail.loadFailed')}
          onRetry={() => void detail.refetch()}
        />
      ) : emi ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.type, { color: colors.onSurfaceVariant }]}>
                {t(`types.${emi.type}`, { defaultValue: emi.type })}
              </Text>
              <GlassPill
                tone={emi.status === 'completed' ? 'gain' : 'neutral'}
                label={t(`status.${emi.status}`, { defaultValue: emi.status })}
              />
            </View>
            <Row label={t('detail.principal')} value={money(emi.principal)} />
            <Row
              label={t('detail.monthly')}
              value={money(emi.emiAmount)}
            />
            <Row
              label={t('detail.interestLabel')}
              value={`${emi.interestRate}%`}
            />
            {feeRow ? (
              <Row
                label={t('detail.processingFee')}
                value={money(feeRow.emiAmount)}
              />
            ) : null}
            <Row label={t('detail.dueDate')} value={date(emi.startDate)} />
            {emi.notes ? (
              <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
                {emi.notes}
              </Text>
            ) : null}
          </View>

          <View
            style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}
          >
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
              {t('detail.amortizationSchedule')}
            </Text>
            {regularPayments.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.scheduleRow,
                  { borderBottomColor: colors.outlineVariant },
                ]}
              >
                <Text
                  style={[styles.scheduleNum, { color: colors.onSurfaceVariant }]}
                >
                  #{p.paymentNumber}
                </Text>
                <View style={styles.scheduleBody}>
                  <Text style={[styles.scheduleDate, { color: colors.onSurface }]}>
                    {date(p.paidAt ?? p.dueDate)}
                  </Text>
                  <Text
                    style={[styles.scheduleMeta, { color: colors.onSurfaceVariant }]}
                  >
                    {t('detail.balanceAbbr')} {money(p.remainingBalance)}
                  </Text>
                </View>
                <Text style={[styles.scheduleAmount, { color: colors.onSurface }]}>
                  {money(p.emiAmount)}
                </Text>
                <GlassPill
                  tone={p.status === 'paid' ? 'gain' : 'neutral'}
                  label={t(`status.${p.status}`, { defaultValue: p.status })}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text style={[styles.kvValue, { color: colors.onSurface }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  type: {
    fontSize: 13,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  kvLabel: {
    fontSize: 13,
  },
  kvValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  notes: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scheduleNum: {
    fontSize: 12,
    minWidth: 28,
  },
  scheduleBody: {
    flex: 1,
    gap: 2,
  },
  scheduleDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  scheduleMeta: {
    fontSize: 12,
  },
  scheduleAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
})
