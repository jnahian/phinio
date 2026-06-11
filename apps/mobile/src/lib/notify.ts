import { Alert } from 'react-native'

/**
 * Error surface for mutation rollbacks — the mobile stand-in for web's
 * sonner toasts. Success feedback stays silent at v1 (the optimistic
 * cache patch IS the feedback); errors interrupt because the user's
 * change was just rolled back.
 */
export function notifyError(err: unknown, fallback: string): void {
  const message = err instanceof Error && err.message ? err.message : fallback
  Alert.alert(fallback, message === fallback ? undefined : message)
}
