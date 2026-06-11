import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Mobile-side unit tests target pure JS logic only (e.g., the glass
// tier resolver). RN platform/accessibility modules are mocked inside
// the tests via `vi.mock(...)`, so a plain node environment suffices —
// no React Native renderer or jsdom is needed.
export default defineConfig({
  resolve: {
    alias: {
      '#': resolve(__dirname, 'src'),
      // The real `react-native` entrypoint uses Flow syntax (`import
      // typeof ...`) that Vite/Rollup can't parse. We never need RN's
      // actual runtime in node-side unit tests, so swap it for a lean
      // stub that exposes just `Platform` + `AccessibilityInfo`.
      'react-native': resolve(__dirname, 'src/test/react-native-stub.ts'),
      // Expo native modules pulled in transitively by lib/trpc → lib/auth.
      // Tests never exercise them; they just need to resolve in node.
      'expo-secure-store': resolve(__dirname, 'src/test/expo-stub.ts'),
      'expo-crypto': resolve(__dirname, 'src/test/expo-stub.ts'),
      '@better-auth/expo/client': resolve(__dirname, 'src/test/expo-stub.ts'),
      'better-auth/react': resolve(__dirname, 'src/test/expo-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
