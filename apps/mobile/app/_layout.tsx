import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { createQueryClient } from '#/lib/query-client'
import { attachPersister } from '#/lib/persister'
import { subscribeToConnectivity } from '#/lib/net-info'
import { getI18n } from '#/lib/i18n'

// Build the QueryClient + i18n instances once at module-evaluation
// time so we don't recreate them on every layout re-render. The
// persister restore is async (even though MMKV reads are sync, the
// persistQueryClient API returns a promise), so the first render
// suspends until it resolves to avoid showing routes against an empty
// cache.
const queryClient = createQueryClient()
const i18n = getI18n()
const restorePromise = attachPersister(queryClient)

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    restorePromise.then(() => {
      if (active) setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    return subscribeToConnectivity(queryClient)
  }, [ready])

  // Block first render until the persister has finished restoring so
  // routes that read cached data see the rehydrated state instead of
  // an empty cache. A splash screen will replace this null in 3C.
  if (!ready) return null

  return (
    // `GestureHandlerRootView` must wrap the whole app for
    // `@gorhom/bottom-sheet` (and any other gesture-handler consumer)
    // to register touches. `SafeAreaProvider` is required by
    // `react-native-safe-area-context`'s `useSafeAreaInsets()` hook
    // used by `GlassNav` / `GlassTabBar`.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <Stack screenOptions={{ headerShown: false }} />
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
