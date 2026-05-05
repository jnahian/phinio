// Single source of truth for investment type display metadata.
//
// `validators.ts#INVESTMENT_TYPES` is the user-selectable set for lump_sum mode.
// `dps` and `savings` are set server-side by the scheduled/flexible flows
// (`server/investments.impl.ts`), so they exist as `Investment.type` values
// in the DB but never appear in the create form's enum. This module is the
// union of all 12 strings that can show up in dashboards / lists.

export const INVESTMENT_TYPES_ALL = [
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
] as const

export type InvestmentTypeAll = (typeof INVESTMENT_TYPES_ALL)[number]

export interface InvestmentTypeMeta {
  label: string
  hex: string
  swatchClass: string
  chipClass: string
}

export const INVESTMENT_TYPE_META: Record<
  InvestmentTypeAll,
  InvestmentTypeMeta
> = {
  stock: {
    label: 'Stock',
    hex: '#2563eb',
    swatchClass: 'bg-[#2563eb]',
    chipClass: 'bg-primary-container/20 text-primary-fixed-dim',
  },
  mutual_fund: {
    label: 'Mutual Fund',
    hex: '#14b8a6',
    swatchClass: 'bg-[#14b8a6]',
    chipClass: 'bg-[#0f3a36]/40 text-[#5eead4]',
  },
  fd: {
    label: 'Fixed Deposit',
    hex: '#8d90a0',
    swatchClass: 'bg-[#8d90a0]',
    chipClass: 'bg-surface-container-highest text-on-surface-variant',
  },
  gold: {
    label: 'Gold',
    hex: '#ffd46a',
    swatchClass: 'bg-[#ffd46a]',
    chipClass: 'bg-[#a07521]/25 text-[#ffd46a]',
  },
  crypto: {
    label: 'Crypto',
    hex: '#c4a8ff',
    swatchClass: 'bg-[#c4a8ff]',
    chipClass: 'bg-[#6a3fc7]/25 text-[#c4a8ff]',
  },
  sanchayapatra: {
    label: 'Sanchayapatra',
    hex: '#dc2626',
    swatchClass: 'bg-[#dc2626]',
    chipClass: 'bg-[#3a1010]/40 text-[#fca5a5]',
  },
  real_estate: {
    label: 'Real Estate',
    hex: '#ec4899',
    swatchClass: 'bg-[#ec4899]',
    chipClass: 'bg-[#3a1a2a]/40 text-[#f9a8d4]',
  },
  agro_farm: {
    label: 'Agro Farm',
    hex: '#a3e635',
    swatchClass: 'bg-[#a3e635]',
    chipClass: 'bg-[#2a3a1a]/40 text-[#bef264]',
  },
  business: {
    label: 'Business',
    hex: '#fb923c',
    swatchClass: 'bg-[#fb923c]',
    chipClass: 'bg-[#3a2a1a]/40 text-[#fdba74]',
  },
  dps: {
    label: 'DPS',
    hex: '#22c55e',
    swatchClass: 'bg-[#22c55e]',
    chipClass: 'bg-[#1a4731]/40 text-[#4ade80]',
  },
  savings: {
    label: 'Savings',
    hex: '#06b6d4',
    swatchClass: 'bg-[#06b6d4]',
    chipClass: 'bg-[#0e3a4a]/40 text-[#67e8f9]',
  },
  other: {
    label: 'Other',
    hex: '#434655',
    swatchClass: 'bg-[#434655]',
    chipClass: 'bg-surface-container-highest text-on-surface-variant',
  },
}

export function getInvestmentTypeMeta(type: string): InvestmentTypeMeta {
  return (
    INVESTMENT_TYPE_META[type as InvestmentTypeAll] ??
    INVESTMENT_TYPE_META.other
  )
}

export interface AllocationRow {
  type: string
  value: string
  percent: number
}

// Keeps donut + legend in sync: both should display the same slices. At most
// `topN` named slices are kept; any tail is merged into a single synthetic
// `other` slice so totals still add to 100%. If the input already contains
// an `other` row, the tail is merged into it instead of producing a duplicate.
//
// Output is sorted by value descending so a large rolled-up `other` settles
// in its correct position rather than always trailing the named slices.
//
// `rows` is expected to contain non-negative values; the helper does not
// re-validate them.
export function collapseAllocationTail(
  rows: ReadonlyArray<AllocationRow>,
  topN: number,
): Array<AllocationRow> {
  const nonOther = rows.filter((r) => r.type !== 'other')

  if (nonOther.length <= topN) {
    // No overflow — preserve the input as-is, including any existing `other`.
    return [...rows]
  }

  const existingOther = rows.find((r) => r.type === 'other')
  const top = nonOther.slice(0, topN)
  const tail = nonOther.slice(topN)

  const mergedValue =
    tail.reduce((s, r) => s + Number(r.value), 0) +
    (existingOther ? Number(existingOther.value) : 0)
  const mergedPercent =
    tail.reduce((s, r) => s + r.percent, 0) + (existingOther?.percent ?? 0)

  if (mergedValue === 0) return top

  const result: Array<AllocationRow> = [
    ...top,
    {
      type: 'other',
      value: mergedValue.toFixed(2),
      percent: Math.round(mergedPercent * 100) / 100,
    },
  ]
  result.sort((a, b) => Number(b.value) - Number(a.value))
  return result
}
