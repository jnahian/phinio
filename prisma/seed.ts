/**
 * Seed script — populates the first user's profile with realistic test data.
 * Run via: npm run db:seed
 *
 * Safe to re-run: all domain data for the profile is deleted first so you
 * always get a clean slate. InvestmentDeposit rows cascade-delete with
 * their parent Investment, so no explicit delete is needed for them.
 */

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  generateAmortization,
  calculateEmi,
} from '../src/lib/emi-calculator.js'
import { generateDpsSchedule } from '../src/lib/dps-calculator.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function d(iso: string): Date {
  return new Date(iso)
}

/** Sum an array of numeric strings. */
function sumStrings(values: string[]): string {
  return values.reduce((acc, v) => acc + Number(v), 0).toFixed(2)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Find the first registered user
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!user) {
    console.error('No users found. Sign up first, then run this seed.')
    process.exit(1)
  }
  console.log(`Seeding data for: ${user.email} (${user.name})`)

  // Upsert profile
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      fullName: user.name,
      preferredCurrency: 'BDT',
    },
    update: {
      fullName: user.name,
      preferredCurrency: 'BDT',
    },
  })
  console.log(`Profile id: ${profile.id}`)

  // Clear existing domain data so seed is idempotent.
  // InvestmentDeposit and EmiPayment rows cascade-delete with their parents.
  await prisma.emi.deleteMany({ where: { profileId: profile.id } })
  await prisma.investment.deleteMany({ where: { profileId: profile.id } })
  try {
    await prisma.notification.deleteMany({ where: { profileId: profile.id } })
  } catch {
    // table doesn't exist yet — skip silently
  }
  console.log('Cleared existing domain data.')

  // -------------------------------------------------------------------------
  // Lump-sum investments (mode: 'lump_sum')
  // -------------------------------------------------------------------------

  const lumpSumInvestments = [
    // Active
    {
      profileId: profile.id,
      name: 'Square Pharmaceuticals',
      type: 'stock',
      mode: 'lump_sum',
      investedAmount: '150000.00',
      currentValue: '189500.00',
      dateOfInvestment: d('2024-01-15'),
      notes: 'Long-term hold — quarterly dividend payer',
      status: 'active',
    },
    {
      profileId: profile.id,
      name: 'BRAC EPF Growth Fund',
      type: 'mutual_fund',
      mode: 'lump_sum',
      investedAmount: '200000.00',
      currentValue: '224800.00',
      dateOfInvestment: d('2023-07-01'),
      notes: 'Monthly SIP of ৳10,000',
      status: 'active',
    },
    {
      profileId: profile.id,
      name: 'Dutch-Bangla Bank FD',
      type: 'fd',
      mode: 'lump_sum',
      investedAmount: '500000.00',
      currentValue: '549750.00',
      dateOfInvestment: d('2024-04-01'),
      notes: '12-month FD at 10.5% p.a.',
      status: 'active',
    },
    {
      profileId: profile.id,
      name: '22K Gold (10 g)',
      type: 'gold',
      mode: 'lump_sum',
      investedAmount: '85000.00',
      currentValue: '97200.00',
      dateOfInvestment: d('2023-10-05'),
      notes: 'Physical gold stored at home locker',
      status: 'active',
    },
    {
      profileId: profile.id,
      name: 'Bitcoin',
      type: 'crypto',
      mode: 'lump_sum',
      investedAmount: '60000.00',
      currentValue: '112000.00',
      dateOfInvestment: d('2024-06-10'),
      notes: '0.015 BTC — cold wallet',
      status: 'active',
    },
    {
      profileId: profile.id,
      name: 'Grameenphone Ltd',
      type: 'stock',
      mode: 'lump_sum',
      investedAmount: '75000.00',
      currentValue: '68300.00',
      dateOfInvestment: d('2024-09-20'),
      status: 'active',
    },
    // Completed
    {
      profileId: profile.id,
      name: 'Islami Bank FD',
      type: 'fd',
      mode: 'lump_sum',
      investedAmount: '300000.00',
      currentValue: '300000.00',
      dateOfInvestment: d('2023-01-01'),
      notes: '12-month FD — matured and encashed',
      status: 'completed',
      exitValue: '333000.00',
      completedAt: d('2024-01-01'),
    },
  ]

  await prisma.investment.createMany({ data: lumpSumInvestments })
  console.log(`Created ${lumpSumInvestments.length} lump-sum investments.`)

  // -------------------------------------------------------------------------
  // DPS investments (mode: 'scheduled') — pre-generated deposit schedule
  // -------------------------------------------------------------------------

  type DpsSeed = {
    name: string
    monthlyDeposit: string
    tenureMonths: number
    interestRate: string
    interestType: 'simple' | 'compound'
    startDate: Date
    paidMonths: number // how many installments to mark as paid
    notes?: string
  }

  const dpsSeeds: DpsSeed[] = [
    {
      name: 'DBBL Monthly Savings Scheme',
      monthlyDeposit: '5000.00',
      tenureMonths: 36,
      interestRate: '7.50',
      interestType: 'simple',
      startDate: d('2024-01-01'),
      paidMonths: 15,
      notes: 'Dutch-Bangla Bank DPS — auto-debit on 1st of each month',
    },
    {
      name: 'Islami Bank DPS',
      monthlyDeposit: '3000.00',
      tenureMonths: 24,
      interestRate: '8.00',
      interestType: 'compound',
      startDate: d('2024-06-01'),
      paidMonths: 10,
      notes: 'Islami Bank — Mudaraba savings scheme',
    },
  ]

  for (const seed of dpsSeeds) {
    const schedule = generateDpsSchedule({
      monthlyDeposit: seed.monthlyDeposit,
      tenureMonths: seed.tenureMonths,
      annualRate: seed.interestRate,
      interestType: seed.interestType,
      startDate: seed.startDate,
    })

    const paidRows = schedule.slice(0, seed.paidMonths)
    const totalPaid = sumStrings(paidRows.map((r) => r.depositAmount))

    const inv = await prisma.investment.create({
      data: {
        profileId: profile.id,
        name: seed.name,
        type: 'dps',
        mode: 'scheduled',
        investedAmount: totalPaid,
        currentValue: totalPaid,
        monthlyDeposit: seed.monthlyDeposit,
        tenureMonths: seed.tenureMonths,
        interestRate: seed.interestRate,
        interestType: seed.interestType,
        startDate: seed.startDate,
        notes: seed.notes,
        status: seed.paidMonths >= seed.tenureMonths ? 'matured' : 'active',
      },
    })

    await prisma.investmentDeposit.createMany({
      data: schedule.map((s) => ({
        investmentId: inv.id,
        profileId: profile.id,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        amount: s.depositAmount,
        accruedValue: s.accruedValue,
        status: s.installmentNumber <= seed.paidMonths ? 'paid' : 'upcoming',
        paidAt:
          s.installmentNumber <= seed.paidMonths
            ? new Date(s.dueDate.getTime() + 3 * 24 * 60 * 60 * 1000) // paid 3 days after due
            : null,
      })),
    })

    console.log(
      `  DPS: ${seed.name} (${seed.tenureMonths}m, ${seed.paidMonths} paid) — ৳${seed.monthlyDeposit}/month`,
    )
  }

  // -------------------------------------------------------------------------
  // Savings pots (mode: 'flexible') — ad-hoc deposit transactions
  // -------------------------------------------------------------------------

  type SavingsSeed = {
    name: string
    startDate: Date
    currentValue: string // manually-set balance (may include interest)
    notes?: string
    deposits: { amount: string; date: Date; notes?: string }[]
  }

  const savingsSeeds: SavingsSeed[] = [
    {
      name: 'Emergency Fund',
      startDate: d('2024-01-01'),
      currentValue: '185000.00', // slightly higher than total deposited due to interest
      notes: 'High-yield savings — target 6 months of expenses',
      deposits: [
        { amount: '50000.00', date: d('2024-01-05'), notes: 'Initial deposit' },
        { amount: '20000.00', date: d('2024-02-05'), notes: 'February top-up' },
        { amount: '20000.00', date: d('2024-03-05'), notes: 'March top-up' },
        { amount: '20000.00', date: d('2024-04-05'), notes: 'April top-up' },
        {
          amount: '30000.00',
          date: d('2024-06-01'),
          notes: 'Bonus allocation',
        },
        { amount: '20000.00', date: d('2024-08-05') },
        { amount: '20000.00', date: d('2024-10-05') },
      ],
    },
    {
      name: 'Vacation Fund',
      startDate: d('2024-04-01'),
      currentValue: '62500.00',
      notes: "Cox's Bazar + Thailand trip savings",
      deposits: [
        { amount: '15000.00', date: d('2024-04-01'), notes: 'Initial' },
        { amount: '10000.00', date: d('2024-05-01') },
        { amount: '10000.00', date: d('2024-06-01') },
        { amount: '10000.00', date: d('2024-07-01') },
        { amount: '15000.00', date: d('2024-09-01'), notes: 'Extra push' },
      ],
    },
  ]

  for (const seed of savingsSeeds) {
    const totalDeposited = sumStrings(seed.deposits.map((dep) => dep.amount))

    const inv = await prisma.investment.create({
      data: {
        profileId: profile.id,
        name: seed.name,
        type: 'savings',
        mode: 'flexible',
        investedAmount: totalDeposited,
        currentValue: seed.currentValue,
        startDate: seed.startDate,
        notes: seed.notes,
        status: 'active',
      },
    })

    await prisma.investmentDeposit.createMany({
      data: seed.deposits.map((dep) => ({
        investmentId: inv.id,
        profileId: profile.id,
        amount: dep.amount,
        dueDate: dep.date,
        paidAt: dep.date,
        status: 'paid',
        notes: dep.notes,
      })),
    })

    console.log(
      `  Savings: ${seed.name} (${seed.deposits.length} deposits, total ৳${totalDeposited})`,
    )
  }

  // -------------------------------------------------------------------------
  // EMIs
  // -------------------------------------------------------------------------

  type EmiSeed = {
    label: string
    type: 'bank_loan' | 'credit_card'
    principal: string
    interestRate: string
    tenureMonths: number
    startDate: Date
    paidMonths?: number
  }

  const emiSeeds: EmiSeed[] = [
    {
      label: 'Home Loan — BRAC Bank',
      type: 'bank_loan',
      principal: '3500000.00',
      interestRate: '9.00',
      tenureMonths: 240, // 20 years
      startDate: d('2022-04-01'),
      paidMonths: 24,
    },
    {
      label: 'Car Loan — Toyota Axio',
      type: 'bank_loan',
      principal: '1200000.00',
      interestRate: '11.50',
      tenureMonths: 60,
      startDate: d('2023-06-01'),
      paidMonths: 10,
    },
    {
      label: 'Credit Card — Standard Chartered',
      type: 'credit_card',
      principal: '85000.00',
      interestRate: '24.00',
      tenureMonths: 12,
      startDate: d('2025-10-01'),
      paidMonths: 6,
    },
    {
      label: 'Personal Loan — Dutch-Bangla Bank',
      type: 'bank_loan',
      principal: '250000.00',
      interestRate: '13.00',
      tenureMonths: 24,
      startDate: d('2025-08-01'),
      paidMonths: 8,
    },
  ]

  for (const seed of emiSeeds) {
    const { emiAmount } = calculateEmi({
      principal: seed.principal,
      annualRate: seed.interestRate,
      tenureMonths: seed.tenureMonths,
    })
    const schedule = generateAmortization({
      principal: seed.principal,
      annualRate: seed.interestRate,
      tenureMonths: seed.tenureMonths,
      startDate: seed.startDate,
    })

    const emi = await prisma.emi.create({
      data: {
        profileId: profile.id,
        label: seed.label,
        type: seed.type,
        principal: seed.principal,
        interestRate: seed.interestRate,
        tenureMonths: seed.tenureMonths,
        emiAmount,
        startDate: seed.startDate,
        status: 'active',
      },
    })

    const paidCount = seed.paidMonths ?? 0
    await prisma.emiPayment.createMany({
      data: schedule.map((row) => ({
        emiId: emi.id,
        profileId: profile.id,
        paymentNumber: row.paymentNumber,
        dueDate: row.dueDate,
        emiAmount: row.emiAmount,
        principalComponent: row.principalComponent,
        interestComponent: row.interestComponent,
        remainingBalance: row.remainingBalance,
        status: row.paymentNumber <= paidCount ? 'paid' : 'upcoming',
        paidAt:
          row.paymentNumber <= paidCount
            ? new Date(row.dueDate.getTime() + 2 * 24 * 60 * 60 * 1000)
            : null,
      })),
    })

    console.log(
      `  EMI: ${seed.label} (${seed.tenureMonths} months, ${paidCount} paid) — EMI ৳${emiAmount}`,
    )
  }

  console.log('\nSeed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
