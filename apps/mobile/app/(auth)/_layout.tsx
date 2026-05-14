import { Redirect, Stack } from 'expo-router'
import { authClient } from '#/lib/auth'

export default function AuthLayout() {
  const { data: session, isPending } = authClient.useSession()
  if (!isPending && session) return <Redirect href="/(app)" />
  return <Stack screenOptions={{ headerShown: false }} />
}
