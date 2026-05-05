import { describe, expect, it } from 'vitest'
import {
  type AllocationRow,
  collapseAllocationTail,
  getInvestmentTypeMeta,
} from '#/lib/investment-types'

function row(type: string, value: number, percent: number): AllocationRow {
  return { type, value: value.toFixed(2), percent }
}

describe('collapseAllocationTail', () => {
  it('returns an empty array for empty input', () => {
    expect(collapseAllocationTail([], 5)).toEqual([])
  })

  it('returns input unchanged when count is below topN', () => {
    const input = [row('stock', 600, 60), row('gold', 400, 40)]
    expect(collapseAllocationTail(input, 5)).toEqual(input)
  })

  it('returns input unchanged at exactly topN', () => {
    const input = [
      row('stock', 300, 30),
      row('mutual_fund', 250, 25),
      row('gold', 200, 20),
      row('crypto', 150, 15),
      row('fd', 100, 10),
    ]
    expect(collapseAllocationTail(input, 5)).toEqual(input)
  })

  it('preserves an existing `other` row when count is within topN', () => {
    // 4 named + 1 existing other = 5 total. No overflow, no synthetic merge.
    const input = [
      row('stock', 500, 50),
      row('gold', 200, 20),
      row('crypto', 150, 15),
      row('fd', 100, 10),
      row('other', 50, 5),
    ]
    expect(collapseAllocationTail(input, 5)).toEqual(input)
  })

  it('rolls overflow into a synthetic `other` slice', () => {
    // 6 named types → top 5 + 1 collapsed
    const input = [
      row('stock', 500, 50),
      row('mutual_fund', 200, 20),
      row('gold', 100, 10),
      row('crypto', 80, 8),
      row('fd', 70, 7),
      row('agro_farm', 50, 5),
    ]
    const out = collapseAllocationTail(input, 5)
    expect(out).toHaveLength(6)
    expect(out[5]).toEqual(row('other', 50, 5))
  })

  it('aggregates multiple tail items into a single `other` row', () => {
    const input = [
      row('stock', 500, 50),
      row('mutual_fund', 200, 20),
      row('gold', 80, 8),
      row('crypto', 70, 7),
      row('fd', 60, 6),
      row('agro_farm', 40, 4),
      row('business', 30, 3),
      row('savings', 20, 2),
    ]
    const out = collapseAllocationTail(input, 5)
    expect(out).toHaveLength(6)
    const other = out.find((r) => r.type === 'other')
    expect(other?.value).toBe('90.00') // 40 + 30 + 20
    expect(other?.percent).toBe(9) // 4 + 3 + 2
  })

  it('merges an existing `other` into the synthetic `other` when overflow occurs', () => {
    const input = [
      row('stock', 400, 40),
      row('mutual_fund', 200, 20),
      row('gold', 150, 15),
      row('crypto', 100, 10),
      row('fd', 80, 8),
      row('agro_farm', 50, 5),
      row('other', 20, 2),
    ]
    const out = collapseAllocationTail(input, 5)
    expect(out).toHaveLength(6)
    const other = out.find((r) => r.type === 'other')
    expect(other?.value).toBe('70.00') // tail (50) + existing other (20)
    expect(other?.percent).toBe(7)
    // Each named type appears at most once, no duplicate `other` row.
    expect(out.filter((r) => r.type === 'other')).toHaveLength(1)
  })

  it('places `other` in sorted position when its merged value beats named slices', () => {
    // Top 5 named slices are small; the tail-aggregated `other` outranks
    // some of them. The legend should still read sorted descending.
    const input = [
      row('stock', 100, 10),
      row('mutual_fund', 90, 9),
      row('gold', 80, 8),
      row('crypto', 70, 7),
      row('fd', 60, 6),
      row('agro_farm', 200, 20),
      row('business', 200, 20),
      row('savings', 200, 20),
    ]
    const out = collapseAllocationTail(input, 5)
    const values = out.map((r) => Number(r.value))
    const sortedDesc = [...values].sort((a, b) => b - a)
    expect(values).toEqual(sortedDesc)
    expect(out[0]?.type).toBe('other') // 600 from agro+business+savings
    expect(out[0]?.value).toBe('600.00')
  })

  it('omits the synthetic `other` when its merged value is zero', () => {
    // Hypothetical: overflow rows all report 0 and there's no existing other.
    const input = [
      row('stock', 100, 100),
      row('mutual_fund', 0, 0),
      row('gold', 0, 0),
      row('crypto', 0, 0),
      row('fd', 0, 0),
      row('agro_farm', 0, 0),
    ]
    const out = collapseAllocationTail(input, 5)
    expect(out).toHaveLength(5)
    expect(out.find((r) => r.type === 'other')).toBeUndefined()
  })

  it('rounds aggregated percent to 2 decimal places', () => {
    const input = [
      row('stock', 100, 10),
      row('mutual_fund', 100, 10),
      row('gold', 100, 10),
      row('crypto', 100, 10),
      row('fd', 100, 10),
      row('agro_farm', 33.33, 3.33),
      row('business', 33.33, 3.33),
      row('savings', 33.34, 3.34),
    ]
    const out = collapseAllocationTail(input, 5)
    const other = out.find((r) => r.type === 'other')
    expect(other?.percent).toBe(10) // 3.33 + 3.33 + 3.34
  })
})

describe('getInvestmentTypeMeta', () => {
  it('returns metadata for a known type', () => {
    const meta = getInvestmentTypeMeta('stock')
    expect(meta.label).toBe('Stock')
    expect(meta.hex).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('returns metadata for every type that the server may persist', () => {
    const persistedTypes = [
      'stock',
      'mutual_fund',
      'fd',
      'gold',
      'crypto',
      'sanchayapatra',
      'real_estate',
      'agro_farm',
      'business',
      'dps',
      'savings',
      'other',
    ]
    for (const t of persistedTypes) {
      const meta = getInvestmentTypeMeta(t)
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.hex).toMatch(/^#[0-9a-f]{6}$/i)
      expect(meta.swatchClass).toContain('bg-')
      expect(meta.chipClass).toContain('text-')
    }
  })

  it('falls back to the `other` palette for an unknown type string', () => {
    const meta = getInvestmentTypeMeta('not-a-real-type')
    expect(meta.label).toBe('Other')
  })
})
