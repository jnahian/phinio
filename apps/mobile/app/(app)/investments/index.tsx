import { useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { calculateReturnPercent } from '@phinio/calc'
import { GlassNav, GlassPill } from '#/components/glass'
import { FilterPills } from '#/components/FilterPills'
import { EmptyState, ErrorState, LoadingState } from '#/components/ScreenState'
import { useTheme } from '#/theme/use-theme'
import { useInvestmentsQuery } from '#/hooks/useInvestments'
import type { InvestmentListItem } from '#/hooks/useInvestments'
import { useMoney } from '#/hooks/useMoney'

type StatusFilter = 'active' | 'completed'

export default function InvestmentsScreen() {
  const { t } = useTranslation('investments')
  const { colors } = useTheme()
  const router = useRouter()
  const { money } = useMoney()
  const [status, setStatus] = useState<StatusFilter>('active')

  const list = useInvestmentsQuery({ status, type: 'all' })
  const rows = list.data ?? []

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav title={t('list.title')} />
      <FilterPills
        options={[
          { value: 'active', label: t('list.active') },
          { value: 'completed', label: t('list.completed') },
        ]}
        value={status}
        onChange={setStatus}
      />
      {list.isPending && rows.length === 0 ? (
        <LoadingState />
      ) : list.isError && rows.length === 0 ? (
        <ErrorState
          message={t('list.loadFailed')}
          onRetry={() => void list.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={status === 'active' ? t('list.empty') : t('list.noExits')}
          hint={status === 'active' ? t('list.emptyHint') : t('list.noExitsHint')}
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item: InvestmentListItem) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={() => void list.refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }: { item: InvestmentListItem }) => (
            <InvestmentRow
              item={item}
              money={money}
              onPress={() => router.push(`/investments/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  )
}

function InvestmentRow({
  item,
  money,
  onPress,
}: {
  item: InvestmentListItem
  money: (amount: string | null | undefined) => string
  onPress: () => void
}) {
  const { t } = useTranslation('investments')
  const { colors } = useTheme()

  const isScheduled = item.mode === 'scheduled'
  // Withdrawals restore realized gains to the return calculation, same
  // as the dashboard's gainLossPercent.
  const current = Number(item.currentValue) + Number(item.totalWithdrawn)
  const pct = calculateReturnPercent(item.investedAmount, String(current))
  const tone = pct > 0 ? 'gain' : pct < 0 ? 'loss' : 'neutral'

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.row, { backgroundColor: colors.surfaceContainerLow }]}
    >
      <View style={styles.rowHeader}>
        <Text
          style={[styles.rowName, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.rowType, { color: colors.onSurfaceVariant }]}>
          {t(`types.${item.type}`, { defaultValue: item.type })}
        </Text>
      </View>
      <View style={styles.rowFooter}>
        <View style={styles.rowAmounts}>
          <Text style={[styles.rowInvested, { color: colors.onSurfaceVariant }]}>
            {money(item.investedAmount)}
          </Text>
          <Text style={[styles.rowCurrent, { color: colors.onSurface }]}>
            {money(item.currentValue)}
          </Text>
          {isScheduled && item.monthlyDeposit ? (
            <Text style={[styles.rowMeta, { color: colors.onSurfaceVariant }]}>
              {money(item.monthlyDeposit)}
              {t('list.perMonth')} ·{' '}
              {t('list.deposits', { count: item.paidCount })}
            </Text>
          ) : null}
        </View>
        <GlassPill
          tone={tone}
          label={`${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`}
        />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  row: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  rowType: {
    fontSize: 12,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  rowAmounts: {
    flex: 1,
    gap: 2,
  },
  rowInvested: {
    fontSize: 12,
  },
  rowCurrent: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
})
