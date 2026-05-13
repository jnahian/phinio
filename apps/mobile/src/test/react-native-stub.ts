// Minimal `react-native` stub used by vitest. The real module ships
// Flow syntax that Vite/Rollup can't parse. We only need the surface
// area touched by our pure-JS unit tests (currently just
// `glass-tier.ts`). Production builds bundle the real RN module via
// Metro — this stub is test-only.

export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web' | 'windows' | 'macos',
  Version: 26 as number | string,
  select: <T>(specs: Record<string, T>): T | undefined =>
    specs.ios ?? specs.default,
}

export const AccessibilityInfo = {
  isReduceTransparencyEnabled: async () => false,
  addEventListener: (_event: string, _handler: (value: boolean) => void) => ({
    remove: () => {},
  }),
}
