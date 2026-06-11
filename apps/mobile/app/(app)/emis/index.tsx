import { useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { inferProcedureOutput } from '@trpc/server'
import type { AppRouter } from '@phinio/trpc'
import { GlassFAB, GlassNav } from '#/components/glass'
import { FilterPills } from '#/components/FilterPills'
import { EmptyState, ErrorState, LoadingState } from '#/components/ScreenState'
import { useTheme } from '#/theme/use-theme'
import { useEmisQuery } from '#/hooks/useEmis'
import { useMoney } from '#/hooks/useMoney'

type EmiListRow = inferProcedureOutput<AppRouter['emis']['list']>[number]
type StatusFilter = 'active' | 'completed'

export default function EmisScreen() {
  const { t } = useTranslation('emis')
  const { colors } = useTheme()
  const router = useRouter()
  const { money, date } = useMoney()
  const [status, setStatus] = useState<StatusFilter>('active')

  const list = useEmisQuery({ status, type: 'all' })
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
          title={status === 'active' ? t('list.empty') : t('list.noCompleted')}
          hint={
            status === 'active' ? t('list.emptyHint') : t('list.noCompletedHint')
          }
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(item: EmiListRow) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={list.isRefetching}
              onRefresh={() => void list.refetch()}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }: { item: EmiListRow }) => (
            <EmiRow
              item={item}
              money={money}
              date={date}
              onPress={() => router.push(`/emis/${item.id}`)}
            />
          )}
        />
      )}
      <GlassFAB
        onPress={() => router.push('/emis/new')}
        accessibilityLabel={t('list.addCta')}
      />
    </View>
  )
}

function EmiRow({
  item,
  money,
  date,
  onPress,
}: {
  item: EmiListRow
  money: (amount: string | null | undefined) => string
  date: (value: Date | string | null | undefined) => string
  onPress: () => void
}) {
  const { t } = useTranslation('emis')
  const { colors } = useTheme()
  const progress =
    item.totalPayments > 0 ? item.paidCount / item.totalPayments : 0

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
          {item.label}
        </Text>
        <Text style={[styles.rowType, { color: colors.onSurfaceVariant }]}>
          {t(`types.${item.type}`, { defaultValue: item.type })}
        </Text>
      </View>
      <View style={styles.rowAmounts}>
        <Text style={[styles.rowMonthly, { color: colors.onSurface }]}>
          {money(item.emiAmount)}
          <Text style={[styles.rowMeta, { color: colors.onSurfaceVariant }]}>
            {t('list.perMonth')}
          </Text>
        </Text>
        <Text style={[styles.rowMeta, { color: colors.onSurfaceVariant }]}>
          {t('list.remaining')}: {money(item.remainingBalance)}
        </Text>
      </View>
      <View
        style={[
          styles.progressTrack,
          { backgroundColor: colors.surfaceContainerHighest },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${Math.min(100, Math.round(progress * 100))}%`,
            },
          ]}
        />
      </View>
      <View style={styles.rowFooter}>
        <Text style={[styles.rowMeta, { color: colors.onSurfaceVariant }]}>
          {item.paidCount}/{item.totalPayments} {t('list.paid')}
        </Text>
        {item.nextDueDate ? (
          <Text style={[styles.rowMeta, { color: colors.onSurfaceVariant }]}>
            {t('list.next')}: {date(item.nextDueDate)}
          </Text>
        ) : null}
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
  rowAmounts: {
    gap: 2,
  },
  rowMonthly: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '400',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
