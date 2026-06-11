import { useEffect, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { updateProfileNameSchema } from '@phinio/validators'
import { GlassNav } from '#/components/glass'
import { FilterPills } from '#/components/FilterPills'
import { FormField } from '#/components/FormField'
import { useTheme } from '#/theme/use-theme'
import {
  useProfileQuery,
  useUpdateProfileCurrency,
  useUpdateProfileLanguage,
  useUpdateProfileName,
} from '#/hooks/useProfile'
import { authClient } from '#/lib/auth'

export default function SettingsScreen() {
  const { t } = useTranslation('profile')
  const { colors } = useTheme()
  const router = useRouter()

  const profile = useProfileQuery()
  const updateName = useUpdateProfileName()
  const updateCurrency = useUpdateProfileCurrency()
  const updateLanguage = useUpdateProfileLanguage()

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()

  // Seed the name field once the profile loads (and after external edits).
  useEffect(() => {
    if (profile.data) setName(profile.data.fullName)
  }, [profile.data])

  const submitName = () => {
    const parsed = updateProfileNameSchema.safeParse({ fullName: name })
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message)
      return
    }
    setNameError(undefined)
    updateName.mutate(parsed.data)
  }

  const confirmSignOut = () => {
    Alert.alert(t('danger.signOut'), t('danger.signOutMessage'), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('danger.signOut'),
        style: 'destructive',
        onPress: () => {
          void authClient.signOut().finally(() => {
            router.replace('/(auth)/login')
          })
        },
      },
    ])
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav title={t('common:tabs.settings')} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}
        >
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            {t('name.title')}
          </Text>
          <FormField
            label={t('name.label')}
            value={name}
            onChangeText={setName}
            error={nameError}
          />
          <Pressable
            onPress={submitName}
            disabled={updateName.isPending || name === profile.data?.fullName}
            accessibilityRole="button"
            style={[styles.button, { borderColor: colors.outline }]}
          >
            <Text style={[styles.buttonText, { color: colors.primary }]}>
              {t('name.submit')}
            </Text>
          </Pressable>
        </View>

        <View
          style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}
        >
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            {t('currency.title')}
          </Text>
          <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>
            {t('currency.hint')}
          </Text>
          <FilterPills
            options={[
              { value: 'BDT', label: `৳ ${t('currency.bdtName')}` },
              { value: 'USD', label: `$ ${t('currency.usdName')}` },
            ]}
            value={profile.data?.preferredCurrency ?? 'BDT'}
            onChange={(preferredCurrency) =>
              updateCurrency.mutate({ preferredCurrency })
            }
          />
        </View>

        <View
          style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}
        >
          <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
            {t('language.title')}
          </Text>
          <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>
            {t('language.hint')}
          </Text>
          <FilterPills
            options={[
              { value: 'en', label: 'English' },
              { value: 'bn', label: 'বাংলা' },
            ]}
            value={profile.data?.preferredLanguage ?? 'en'}
            onChange={(preferredLanguage) =>
              updateLanguage.mutate({ preferredLanguage })
            }
          />
        </View>

        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          style={[styles.signOut, { borderColor: colors.outline }]}
        >
          <Text style={[styles.buttonText, { color: colors.tertiary }]}>
            {t('danger.signOut')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
  },
  button: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signOut: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
})
