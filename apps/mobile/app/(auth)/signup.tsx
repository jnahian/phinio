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

export default function SignupScreen() {
  const { t } = useTranslation('auth')
  const { colors } = useTheme()
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async () => {
    setError(null)
    setSubmitting(true)
    const res = await authClient.signUp.email({ email, password, name })
    setSubmitting(false)
    if (res.error) {
      setError(res.error.message ?? t('signup.genericError'))
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
            {t('signup.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {t('signup.subtitle')}
          </Text>

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            {t('signup.fullNameLabel')}
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
            placeholder={t('signup.fullNamePlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            {t('signup.emailLabel')}
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
            placeholder={t('signup.emailPlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
            {t('signup.passwordLabel')}
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
            placeholder={t('signup.passwordPlaceholder')}
            placeholderTextColor={colors.onSurfaceVariant}
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
              {submitting ? t('signup.submitting') : t('signup.submit')}
            </Text>
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={{ color: colors.onSurfaceVariant }}>
              {t('signup.haveAccount')}{' '}
            </Text>
            <Link
              href="/(auth)/login"
              style={[styles.link, { color: colors.primary }]}
            >
              {t('signup.login')}
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
  button: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { fontSize: 14, fontWeight: '600' },
  footerRow: { flexDirection: 'row', marginTop: 24, flexWrap: 'wrap' },
})
