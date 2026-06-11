// Lean stubs for Expo native modules so node-side unit tests can import
// modules whose chain touches expo-secure-store / expo-crypto / the
// Better Auth Expo client. None of the stubbed behaviour is exercised
// by tests — they only need the imports to resolve.
export function getItemAsync(): Promise<string | null> {
  return Promise.resolve(null)
}
export function setItemAsync(): Promise<void> {
  return Promise.resolve()
}
export function deleteItemAsync(): Promise<void> {
  return Promise.resolve()
}
export function randomUUID(): string {
  // Deterministic-shape fallback; tests that need real uuids mock this.
  return '00000000-0000-4000-8000-000000000000'
}
export function expoClient() {
  return { id: 'expo-stub' }
}
export function createAuthClient() {
  return { useSession: () => ({ data: null, isPending: false }) }
}
export default {}
