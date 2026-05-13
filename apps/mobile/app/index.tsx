import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Link } from 'expo-router'
import { useTheme } from '#/theme/use-theme'

export default function Index() {
  const { t } = useTranslation('common')
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.onSurface }]}>
        {t('appName')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
        {t('tagline')}
      </Text>
      {/* DEV-ONLY: link to the glass-primitives demo. Remove or gate
          before the first production release. */}
      <Link
        href="/glass-demo"
        style={[styles.devLink, { color: colors.primary }]}
      >
        Open glass demo →
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  devLink: {
    marginTop: 32,
    fontSize: 14,
    fontWeight: '600',
  },
})
