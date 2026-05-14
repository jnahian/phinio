import { createAuthClient } from 'better-auth/react'
import { expoClient } from '@better-auth/expo/client'
import * as SecureStore from 'expo-secure-store'

const BASE_URL =
  process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3000'

/**
 * Better Auth client for the Expo runtime. The `expoClient` plugin
 * persists the bearer token in `expo-secure-store` under the
 * `phinio_*` key prefix and attaches it to outgoing requests.
 */
export const authClient = createAuthClient({
  baseURL: BASE_URL,
  plugins: [
    expoClient({
      scheme: 'phinio',
      storagePrefix: 'phinio',
      storage: SecureStore,
    }),
  ],
})

export const SESSION_TOKEN_KEY = 'phinio_session_token'

/**
 * Reads the persisted bearer token directly from SecureStore. Used by
 * the tRPC client to inject `Authorization: Bearer <token>` on each
 * request. The `@better-auth/expo` plugin writes the cookie value
 * here under `<storagePrefix>_session_token`.
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
  } catch {
    return null
  }
}
