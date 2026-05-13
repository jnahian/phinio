import { defineConfig } from 'vitest/config'

// Mobile-side unit tests target pure JS logic only (e.g., the glass
// tier resolver). RN platform/accessibility modules are mocked inside
// the tests via `vi.mock(...)`, so a plain node environment suffices —
// no React Native renderer or jsdom is needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
