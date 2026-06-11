import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SymbolView } from 'expo-symbols'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '#/theme/use-theme'
import { useUnreadNotificationCountQuery } from '#/hooks/useNotifications'

export type NotificationsBellProps = {
  onPress: () => void
}

/**
 * Bell icon with an unread-count badge. Same per-platform icon pattern
 * as `GlassTabBar`: SF Symbols on iOS, MaterialIcons elsewhere.
 */
export function NotificationsBell({ onPress }: NotificationsBellProps) {
  const { t } = useTranslation('notifications')
  const { colors } = useTheme()
  const { data } = useUnreadNotificationCountQuery()
  const count = data?.count ?? 0

  const accessibilityLabel =
    count > 0
      ? t('ariaLabelUnread', { count })
      : t('ariaLabel')

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={styles.container}
    >
      {Platform.OS === 'ios' ? (
        <SymbolView
          name="bell"
          size={22}
          tintColor={colors.onSurface}
          fallback={
            <MaterialIcons
              name="notifications-none"
              size={22}
              color={colors.onSurface}
            />
          }
        />
      ) : (
        <MaterialIcons
          name="notifications-none"
          size={22}
          color={colors.onSurface}
        />
      )}
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.tertiary }]}>
          <Text style={[styles.badgeText, { color: colors.surface }]}>
            {count > 9 ? '9+' : String(count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
})
