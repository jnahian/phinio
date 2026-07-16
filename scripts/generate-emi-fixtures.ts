/**
 * Generates paisa-exact fixtures from the TS EMI calculator for the Swift
 * port's tests. Rerun after any calculator change:
 *   npx tsx scripts/generate-emi-fixtures.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { calculateEmi, generateAmortization } from '../src/lib/emi-calculator'
import type { EmiMethod } from '../src/lib/emi-calculator'

interface Case {
  name: string
  principal: string
  annualRate: string
  tenureMonths: number
  startDate: string // YYYY-MM-DD
  type?: EmiMethod
}

const cases: Array<Case> = [
  {
    name: 'standard reducing',
    principal: '100000',
    annualRate: '12',
    tenureMonths: 12,
    startDate: '2026-01-15',
  },
  {
    name: 'zero rate degenerates to P/n',
    principal: '90000',
    annualRate: '0',
    tenureMonths: 9,
    startDate: '2026-02-01',
  },
  {
    name: 'credit card flat rate',
    principal: '50000',
    annualRate: '24',
    tenureMonths: 6,
    startDate: '2026-03-10',
    type: 'credit_card',
  },
  {
    name: 'long tenure 360 months',
    principal: '2500000',
    annualRate: '8.5',
    tenureMonths: 360,
    startDate: '2026-04-01',
  },
  {
    name: 'month-end clamp Jan 31',
    principal: '12000',
    annualRate: '10',
    tenureMonths: 4,
    startDate: '2026-01-31',
  },
  {
    name: 'single payment',
    principal: '9999.99',
    annualRate: '15',
    tenureMonths: 1,
    startDate: '2026-06-05',
  },
  {
    name: 'tiny principal odd rate',
    principal: '101',
    annualRate: '17.99',
    tenureMonths: 7,
    startDate: '2026-12-31',
  },
]

const fixtures = cases.map((c) => {
  const input = {
    principal: c.principal,
    annualRate: c.annualRate,
    tenureMonths: c.tenureMonths,
    startDate: new Date(`${c.startDate}T00:00:00.000Z`),
    type: c.type,
  }
  const breakdown = calculateEmi(input)
  const rows = generateAmortization(input).map((r) => ({
    ...r,
    dueDate: r.dueDate.toISOString().slice(0, 10),
  }))
  return { name: c.name, input: { ...c }, breakdown, rows }
})

const out = resolve(
  process.cwd(),
  'apps/ios/Phinio/PhinioTests/Fixtures/emi-fixtures.json',
)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(fixtures, null, 2)}\n`)
console.log(`wrote ${fixtures.length} fixtures to ${out}`)
