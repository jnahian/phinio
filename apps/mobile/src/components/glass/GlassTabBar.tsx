import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { SymbolView, type SFSymbol } from 'expo-symbols'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { ComponentProps } from 'react'
import { GlassSurface } from './GlassSurface'
import { useTheme } from '#/theme/use-theme'

export type GlassTabIconName = {
  sf: SFSymbol
  material: ComponentProps<typeof MaterialIcons>['name']
}

/**
 * Bottom tab bar compatible with `expo-router`'s `<Tabs />` tabBar
 * slot. Uses SF Symbols on iOS (via `expo-symbols`) and Material
 * icons on Android (via `@expo/vector-icons`).
 *
 * The icon name for each tab is read from
 * `descriptors[route.key].options.tabBarIcon` if provided as a string,
 * otherwise we fall back to the first letter of the label so the bar
 * is still visible in scaffold screens.
 */
export function GlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()

  return (
    <GlassSurface
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      borderRadius={0}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const isFocused = state.index === index
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name)

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params)
            }
          }

          const tint = isFocused ? colors.primary : colors.onSurfaceVariant
          const iconName = (options as { tabBarIconName?: GlassTabIconName })
            .tabBarIconName

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <TabIcon label={label} tint={tint} icon={iconName} />
              <Text style={[styles.label, { color: tint }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </GlassSurface>
  )
}

function TabIcon({
  label,
  tint,
  icon,
}: {
  label: string
  tint: string
  icon?: GlassTabIconName
}) {
  if (icon) {
    if (Platform.OS === 'ios') {
      return (
        <SymbolView
          name={icon.sf}
          size={22}
          tintColor={tint}
          resizeMode="scaleAspectFit"
        />
      )
    }
    return <MaterialIcons name={icon.material} size={22} color={tint} />
  }
  const initial = label.slice(0, 1).toUpperCase()
  return (
    <View style={styles.iconStub}>
      <Text
        style={[
          styles.iconText,
          { color: tint },
          Platform.OS === 'android' ? styles.iconAndroid : null,
        ]}
      >
        {initial}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  iconStub: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
    fontWeight: '600',
  },
  iconAndroid: {
    fontFamily: 'sans-serif-medium',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
})
