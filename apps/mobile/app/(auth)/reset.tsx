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
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { authClient } from '#/lib/auth'
import { useTheme } from '#/theme/use-theme'

export default function ResetScreen() {
  const { t } = useTranslation('auth')
  const { colors } = useTheme()
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token?: string }>()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    setError(null)
    setSubmitting(true)
    if (token) {
      const res = await authClient.resetPassword({
        token,
        newPassword: password,
      })
      setSubmitting(false)
      if (res.error) {
        setError(res.error.message ?? t('forgotPassword.genericError'))
        return
      }
      router.replace('/(auth)/login')
      return
    }
    const res = await authClient.requestPasswordReset({
      email,
      redirectTo: 'phinio://reset',
    })
    setSubmitting(false)
    if (res.error) {
      setError(res.error.message ?? t('forgotPassword.genericError'))
      return
    }
    setSent(true)
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={[styles.title, { color: colors.onSurface }]}>
            {token ? t('login.passwordLabel') : t('forgotPassword.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {token ? t('signup.passwordPlaceholder') : t('forgotPassword.subtitle')}
          </Text>

          {sent ? (
            <Text style={[styles.success, { color: colors.onSurface }]}>
              {t('forgotPassword.successBody', { email })}
            </Text>
          ) : token ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
                {t('forgotPassword.emailLabel')}
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
                placeholder={t('forgotPassword.emailPlaceholder')}
                placeholderTextColor={colors.onSurfaceVariant}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </>
          )}

          {error ? (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          ) : null}

          {!sent ? (
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
                {submitting
                  ? t('forgotPassword.submitting')
                  : t('forgotPassword.submit')}
              </Text>
            </Pressable>
          ) : null}

          <Link
            href="/(auth)/login"
            style={[styles.link, { color: colors.primary }]}
          >
            {t('forgotPassword.backToLogin')}
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
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
  success: { fontSize: 15, marginTop: 8 },
  button: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { marginTop: 24, fontSize: 14, fontWeight: '600' },
})
