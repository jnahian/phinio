import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { authClient } from '#/lib/auth'
import { useTheme } from '#/theme/use-theme'

export default function LoginScreen() {
  const { t } = useTranslation('auth')
  const { colors } = useTheme()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    setError(null)
    setSubmitting(true)
    const res = await authClient.signIn.email({ email, password })
    setSubmitting(false)
    if (res.error) {
      setError(res.error.message ?? t('login.genericError'))
      return
    }
    router.replace('/(app)')
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.onSurface }]}>
            {t('login.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {t('login.subtitle')}
          </Text>

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            {t('login.emailLabel')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.onSurface,
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
              },
            ]}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            {t('login.passwordLabel')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.onSurface,
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.outlineVariant,
              },
            ]}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={[
              styles.button,
              {
                backgroundColor: submitting
                  ? colors.primaryContainer
                  : colors.primary,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
              {submitting ? t('login.submitting') : t('login.submit')}
            </Text>
          </Pressable>

          <Link href="/(auth)/reset" style={[styles.link, { color: colors.primary }]}>
            {t('login.forgot')}
          </Link>

          <View style={styles.footerRow}>
            <Text style={{ color: colors.onSurfaceVariant }}>
              {t('login.noAccount')}{' '}
            </Text>
            <Link
              href="/(auth)/signup"
              style={[styles.link, { color: colors.primary }]}
            >
              {t('login.createVault')}
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { marginTop: 12, fontSize: 13 },
  button: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { marginTop: 16, fontSize: 14, fontWeight: '600' },
  footerRow: {
    flexDirection: 'row',
    marginTop: 24,
    flexWrap: 'wrap',
  },
})
