import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SymbolView } from 'expo-symbols'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { GlassNav, GlassPill } from '#/components/glass'
import { ErrorState, LoadingState } from '#/components/ScreenState'
import { useTheme } from '#/theme/use-theme'
import { useInvestmentQuery } from '#/hooks/useInvestments'
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

export default function InvestmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useTranslation('investments')
  const { colors } = useTheme()
  const { money, date } = useMoney()

  const detail = useInvestmentQuery(id ?? '')
  const inv = detail.data

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav title={inv?.name ?? ''} leading={<BackButton />} />
      {detail.isPending && !inv ? (
        <LoadingState />
      ) : detail.isError && !inv ? (
        <ErrorState
          message={t('list.loadFailed')}
          onRetry={() => void detail.refetch()}
        />
      ) : inv ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Summary — flat; the nav + tab bar already hold glass budget. */}
          <View
            style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.type, { color: colors.onSurfaceVariant }]}>
                {t(`types.${inv.type}`, { defaultValue: inv.type })}
              </Text>
              <GlassPill
                tone={inv.status === 'active' ? 'neutral' : 'gain'}
                label={
                  inv.status === 'active'
                    ? t('form.active')
                    : t('form.completed')
                }
              />
            </View>
            <Row label={t('form.investedLabel')} value={money(inv.investedAmount)} />
            <Row
              label={t('form.currentValueLabel')}
              value={money(inv.currentValue)}
            />
            {inv.exitValue ? (
              <Row label={t('form.exitValueLabel')} value={money(inv.exitValue)} />
            ) : null}
            {inv.dateOfInvestment ? (
              <Row label={t('form.dateLabel')} value={date(inv.dateOfInvestment)} />
            ) : null}
            {inv.estimatedClosureDate ? (
              <Row
                label={t('form.estimatedClosureLabel')}
                value={date(inv.estimatedClosureDate)}
              />
            ) : null}
            {inv.completedAt ? (
              <Row
                label={t('form.completionDateLabel')}
                value={date(inv.completedAt)}
              />
            ) : null}
            {inv.notes ? (
              <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
                {inv.notes}
              </Text>
            ) : null}
          </View>

          {inv.mode === 'scheduled' && inv.deposits.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                {t('dps.depositSchedule')}
              </Text>
              {inv.deposits.map((d) => (
                <View
                  key={d.id}
                  style={[
                    styles.scheduleRow,
                    { borderBottomColor: colors.outlineVariant },
                  ]}
                >
                  <Text
                    style={[styles.scheduleNum, { color: colors.onSurfaceVariant }]}
                  >
                    #{d.installmentNumber ?? '—'}
                  </Text>
                  <View style={styles.scheduleBody}>
                    <Text style={[styles.scheduleDate, { color: colors.onSurface }]}>
                      {date(d.paidAt ?? d.dueDate)}
                    </Text>
                    {d.accruedValue ? (
                      <Text
                        style={[
                          styles.scheduleMeta,
                          { color: colors.onSurfaceVariant },
                        ]}
                      >
                        {t('dps.balanceAfter')}: {money(d.accruedValue)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.scheduleAmount, { color: colors.onSurface }]}>
                    {money(d.amount)}
                  </Text>
                  <GlassPill
                    tone={d.status === 'paid' ? 'gain' : 'neutral'}
                    label={
                      d.status === 'paid'
                        ? t('dps.statusPaid')
                        : t('dps.statusUpcoming')
                    }
                  />
                </View>
              ))}
            </View>
          ) : null}

          {inv.withdrawals.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                {t('form.withdrawals')}
              </Text>
              {inv.withdrawals.map((w) => (
                <View
                  key={w.id}
                  style={[
                    styles.scheduleRow,
                    { borderBottomColor: colors.outlineVariant },
                  ]}
                >
                  <View style={styles.scheduleBody}>
                    <Text style={[styles.scheduleDate, { color: colors.onSurface }]}>
                      {date(w.withdrawalDate)}
                    </Text>
                    {w.notes ? (
                      <Text
                        style={[
                          styles.scheduleMeta,
                          { color: colors.onSurfaceVariant },
                        ]}
                        numberOfLines={1}
                      >
                        {w.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.scheduleAmount, { color: colors.onSurface }]}>
                    {money(w.amount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
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
