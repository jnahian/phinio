import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '#/theme/use-theme'

/** Centered first-load spinner. */
export function LoadingState() {
  const { colors } = useTheme()
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  )
}

/** Centered error with a retry button. `message` is the domain's loadFailed string. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation('dashboard')
  const { colors } = useTheme()
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.onSurface }]}>{message}</Text>
      <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>
        {t('errors.checkConnection')}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={[styles.retry, { borderColor: colors.outline }]}
      >
        <Text style={[styles.retryText, { color: colors.primary }]}>
          {t('errors.retry')}
        </Text>
      </Pressable>
    </View>
  )
}

/** Centered empty state with a title and supporting hint. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
