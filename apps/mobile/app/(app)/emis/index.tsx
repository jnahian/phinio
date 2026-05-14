import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '#/theme/use-theme'

export default function EmisScreen() {
  const { t } = useTranslation('common')
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.onSurface }]}>
        {t('tabs.emis')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600' },
})
