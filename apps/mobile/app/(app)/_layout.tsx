import { useEffect } from 'react'
import { Redirect, Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { authClient } from '#/lib/auth'
import { configureForegroundNotifications, syncBadgeCount } from '#/lib/push'
import { useUnreadNotificationCountQuery } from '#/hooks/useNotifications'
import { GlassTabBar, type GlassTabIconName } from '#/components/glass'

configureForegroundNotifications()

const ICONS: Record<string, GlassTabIconName> = {
  index: { sf: 'house.fill', material: 'home' },
  investments: { sf: 'chart.line.uptrend.xyaxis', material: 'trending-up' },
  emis: { sf: 'creditcard.fill', material: 'credit-card' },
  activity: { sf: 'list.bullet.rectangle', material: 'receipt-long' },
  settings: { sf: 'gearshape.fill', material: 'settings' },
}

export default function AppLayout() {
  const { t } = useTranslation('common')
  const { data: session, isPending } = authClient.useSession()
  const unread = useUnreadNotificationCountQuery()

  // Keep the app icon badge in sync with unread rows: the query already
  // refetches on foreground/reconnect, so piggyback on its data (§6.3).
  useEffect(() => {
    if (unread.data) void syncBadgeCount(unread.data.count)
  }, [unread.data])

  if (!isPending && !session) return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarIconName: ICONS.index,
        } as never}
      />
      <Tabs.Screen
        name="investments"
        options={{
          title: t('tabs.investments'),
          tabBarIconName: ICONS.investments,
        } as never}
      />
      <Tabs.Screen
        name="emis"
        options={{
          title: t('tabs.emis'),
          tabBarIconName: ICONS.emis,
        } as never}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t('tabs.activity'),
          tabBarIconName: ICONS.activity,
        } as never}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIconName: ICONS.settings,
        } as never}
      />
    </Tabs>
  )
}
