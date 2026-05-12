import { describe, it, expect } from 'vitest'
import * as calc from '../index.js'

describe('@phinio/calc barrel', () => {
  it('exports something', () => {
    const exportedNames = Object.keys(calc)
    expect(exportedNames.length).toBeGreaterThan(0)
  })

  it('exposes the EMI calculator entry point', () => {
    expect(typeof (calc as any).generateAmortization).toBe('function')
  })
})
