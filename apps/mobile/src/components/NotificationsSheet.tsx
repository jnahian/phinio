import { forwardRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { GlassSheet, type GlassSheetHandle } from '#/components/glass'
import { useTheme } from '#/theme/use-theme'
import { useNotificationsQuery } from '#/hooks/useNotifications'

type NotificationRow = {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: Date | string
}

/**
 * Short relative timestamp ("now" / "5m" / "3h" / "2d") matching the
 * web bell's `notifications:shortRelative.*` strings.
 */
function shortRelative(
  createdAt: Date | string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const created =
    typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  const elapsedMs = Date.now() - created.getTime()
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 1) return t('shortRelative.now')
  if (minutes < 60) return t('shortRelative.minutes', { value: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('shortRelative.hours', { value: hours })
  return t('shortRelative.days', { value: Math.floor(hours / 24) })
}

/**
 * Read-only notifications list in a glass bottom sheet. Mark-read /
 * mark-all-read / clear are Phase 5 writes — this surface only shows
 * state, mirroring web's bell dropdown content.
 */
export const NotificationsSheet = forwardRef<GlassSheetHandle>(
  function NotificationsSheet(_props, ref) {
    const { t } = useTranslation('notifications')
    const { colors } = useTheme()
    const { data, isPending } = useNotificationsQuery()

    const rows: NotificationRow[] = data ?? []

    return (
      <GlassSheet ref={ref}>
        <Text style={[styles.title, { color: colors.onSurface }]}>
          {t('title')}
        </Text>
        <BottomSheetFlatList
          data={rows}
          keyExtractor={(item: NotificationRow) => item.id}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>
              {isPending ? t('loading') : t('empty')}
            </Text>
          }
          renderItem={({ item }: { item: NotificationRow }) => (
            <View
              style={[
                styles.row,
                { borderBottomColor: colors.outlineVariant },
              ]}
            >
              {!item.read ? (
                <View
                  style={[styles.unreadDot, { backgroundColor: colors.primary }]}
                />
              ) : (
                <View style={styles.unreadDotSpacer} />
              )}
              <View style={styles.rowBody}>
                <Text
                  style={[
                    styles.rowTitle,
                    {
                      color: item.read
                        ? colors.onSurfaceVariant
                        : colors.onSurface,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[styles.rowText, { color: colors.onSurfaceVariant }]}
                  numberOfLines={2}
                >
                  {item.body}
                </Text>
              </View>
              <Text style={[styles.rowTime, { color: colors.onSurfaceVariant }]}>
                {shortRelative(item.createdAt, t)}
              </Text>
            </View>
          )}
        />
      </GlassSheet>
    )
  },
)

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  unreadDotSpacer: {
    width: 8,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowText: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowTime: {
    fontSize: 12,
    marginTop: 2,
  },
})
