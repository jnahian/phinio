import { Stack } from 'expo-router'

// Nested stack inside the EMIs tab so `[id]` detail screens push over
// the list instead of registering as extra tab routes.
export default function EmisLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
