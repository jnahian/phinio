/**
 * Seed script — populates the first user's profile with realistic test data.
 * Run via: npm run db:seed
 *
 * Safe to re-run: investments and EMIs are created fresh each time (existing
 * ones for the profile are deleted first so you always get a clean slate).
 */

import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  generateAmortization,
  calculateEmi,
} from '../src/lib/emi-calculator.js'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function d(iso: string): Date {
  return new Date(iso)
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

  // Clear existing domain data so seed is idempotent
  await prisma.emiPayment.deleteMany({ where: { profileId: profile.id } })
  await prisma.emi.deleteMany({ where: { profileId: profile.id } })
  await prisma.investment.deleteMany({ where: { profileId: profile.id } })
  // notifications table may not exist yet if migration hasn't been applied
  try {
    await prisma.notification.deleteMany({ where: { profileId: profile.id } })
  } catch {
    // table doesn't exist — skip silently
  }
  console.log('Cleared existing domain data.')

  // -------------------------------------------------------------------------
  // Investments
  // -------------------------------------------------------------------------

  const investments = [
    // Active investments
    {
      profileId: profile.id,
      name: 'Square Pharmaceuticals',
      type: 'stock',
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
      investedAmount: '75000.00',
      currentValue: '68300.00',
      dateOfInvestment: d('2024-09-20'),
      status: 'active',
    },
    // Completed investment
    {
      profileId: profile.id,
      name: 'Islami Bank FD',
      type: 'fd',
      investedAmount: '300000.00',
      currentValue: '300000.00',
      dateOfInvestment: d('2023-01-01'),
      notes: '12-month FD — matured and encashed',
      status: 'completed',
      exitValue: '333000.00',
      completedAt: d('2024-01-01'),
    },
  ]

  await prisma.investment.createMany({ data: investments })
  console.log(`Created ${investments.length} investments.`)

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
    paidMonths?: number // how many payments to mark as paid
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
            ? new Date(row.dueDate.getTime() + 2 * 24 * 60 * 60 * 1000) // paid 2 days after due
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
