import { describe, it, expect } from 'vitest'
import { tokensToCss } from '../build-css.js'

describe('tokensToCss', () => {
  it('emits an @theme block with kebab-cased custom properties', () => {
    const tokens = {
      color: { surface: '#0b1326', 'on-surface': '#e6ecff' },
      radius: { card: '16px' },
    }
    const css = tokensToCss(tokens)
    expect(css).toContain('@theme {')
    expect(css).toContain('--color-surface: #0b1326;')
    expect(css).toContain('--color-on-surface: #e6ecff;')
    expect(css).toContain('--radius-card: 16px;')
    expect(css).toContain('}')
  })

  it('returns an empty @theme block for empty input', () => {
    expect(tokensToCss({})).toBe('@theme {\n}\n')
  })
})
