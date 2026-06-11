import * as Crypto from 'expo-crypto'

/**
 * UUID v4. Hermes doesn't implement `crypto.randomUUID`, so all
 * client-minted ids (entity rows, clientMutationId) go through
 * expo-crypto's native implementation.
 */
export function randomUUID(): string {
  return Crypto.randomUUID()
}
