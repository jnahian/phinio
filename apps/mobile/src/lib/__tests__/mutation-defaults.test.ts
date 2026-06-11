import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { mutationKeys, registerMutationDefaults } from '../mutation-defaults'

describe('registerMutationDefaults', () => {
  it('registers an offlineFirst mutationFn for every exported key', () => {
    const qc = new QueryClient()
    registerMutationDefaults(qc)

    for (const [name, key] of Object.entries(mutationKeys)) {
      const defaults = qc.getMutationDefaults([...key])
      expect(defaults.mutationFn, `${name} has no registered mutationFn`).toBeTypeOf(
        'function',
      )
      expect(defaults.networkMode, `${name} is not offlineFirst`).toBe(
        'offlineFirst',
      )
    }
  })

  it('keys are unique (no two logical mutations share a registry slot)', () => {
    const serialized = Object.values(mutationKeys).map((k) => JSON.stringify(k))
    expect(new Set(serialized).size).toBe(serialized.length)
  })
})
