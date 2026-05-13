import { describe, expect, it } from 'vitest'
import { resolveGlassTier } from '#/lib/glass-tier'

// We unit-test the pure resolver only. The hook (`useGlassTier`) is a
// thin wrapper that wires `Platform` + `AccessibilityInfo` into this
// function; covering it would require a React Native renderer for no
// additional logic coverage.

describe('resolveGlassTier', () => {
  it('returns "liquid" on iOS 26 when reduce-transparency is off', () => {
    expect(
      resolveGlassTier({ os: 'ios', version: 26, reduceTransparency: false }),
    ).toBe('liquid')
  })

  it('returns "liquid" on iOS versions above 26 (e.g., 27, 28)', () => {
    expect(
      resolveGlassTier({ os: 'ios', version: 27, reduceTransparency: false }),
    ).toBe('liquid')
  })

  it('returns "blur" on iOS 25 (Liquid Glass unavailable)', () => {
    expect(
      resolveGlassTier({ os: 'ios', version: 25, reduceTransparency: false }),
    ).toBe('blur')
  })

  it('returns "blur" on Android regardless of version', () => {
    expect(
      resolveGlassTier({ os: 'android', version: 34, reduceTransparency: false }),
    ).toBe('blur')
  })

  it('returns "blur" on web', () => {
    expect(
      resolveGlassTier({ os: 'web', version: undefined, reduceTransparency: false }),
    ).toBe('blur')
  })

  it('returns "flat" when reduce-transparency is on (iOS 26)', () => {
    expect(
      resolveGlassTier({ os: 'ios', version: 26, reduceTransparency: true }),
    ).toBe('flat')
  })

  it('returns "flat" when reduce-transparency is on (Android)', () => {
    expect(
      resolveGlassTier({ os: 'android', version: 34, reduceTransparency: true }),
    ).toBe('flat')
  })

  it('returns "flat" when reduce-transparency is on (web)', () => {
    expect(
      resolveGlassTier({ os: 'web', version: undefined, reduceTransparency: true }),
    ).toBe('flat')
  })

  it('coerces string versions (Platform.Version can be string)', () => {
    expect(
      resolveGlassTier({ os: 'ios', version: '26', reduceTransparency: false }),
    ).toBe('liquid')
    expect(
      resolveGlassTier({ os: 'ios', version: '25.4', reduceTransparency: false }),
    ).toBe('blur')
  })
})
