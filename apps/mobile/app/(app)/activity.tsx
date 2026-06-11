import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import type { ActivityListResult } from '#/hooks/useActivity'
import { GlassNav } from '#/components/glass'
import { EmptyState, ErrorState, LoadingState } from '#/components/ScreenState'
import { useTheme } from '#/theme/use-theme'
import { useActivityQuery } from '#/hooks/useActivity'
import { useMoney } from '#/hooks/useMoney'

type ActivityItem = ActivityListResult['items'][number]

export default function ActivityScreen() {
  const { t } = useTranslation('activity')
  const { colors } = useTheme()
  const { date } = useMoney()

  const activity = useActivityQuery()
  const items: ActivityItem[] =
    activity.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav title={t('title')} />
      {activity.isPending && items.length === 0 ? (
        <LoadingState />
      ) : activity.isError && items.length === 0 ? (
        <ErrorState
          message={t('errors.loadFailed')}
          onRetry={() => void activity.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item: ActivityItem) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (activity.hasNextPage && !activity.isFetchingNextPage) {
              void activity.fetchNextPage()
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={activity.isRefetching && !activity.isFetchingNextPage}
              onRefresh={() => void activity.refetch()}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            activity.isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }: { item: ActivityItem }) => (
            <View
              style={[styles.row, { backgroundColor: colors.surfaceContainerLow }]}
            >
              <View style={styles.rowHeader}>
                <Text style={[styles.rowAction, { color: colors.onSurfaceVariant }]}>
                  {t(`actions.${item.action}`, { defaultValue: item.action })} ·{' '}
                  {t(`entities.${item.entityType}`, {
                    defaultValue: item.entityType,
                  })}
                </Text>
                <Text style={[styles.rowDate, { color: colors.onSurfaceVariant }]}>
                  {date(item.createdAt)}
                </Text>
              </View>
              <Text
                style={[styles.rowSummary, { color: colors.onSurface }]}
                numberOfLines={2}
              >
                {item.summary}
              </Text>
            </View>
          )}
        />
      )}
    </View>
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
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  row: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowAction: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowDate: {
    fontSize: 12,
  },
  rowSummary: {
    fontSize: 14,
    lineHeight: 19,
  },
})
